"""Phase-two disclosure boundary tests using a real accepted Phase-one run."""

from copy import deepcopy
import json
import unittest
from unittest.mock import Mock
from uuid import uuid4

from langgraph.types import Command
from pydantic import ValidationError

from backend.agent import MainAgent
from backend.agent.lender_pack import (
    CalculationVersions, DisclosureAction, DisclosureDecision, DisclosureSection,
    InMemoryAcceptedRuns, InMemoryPackRepository, LenderPackService, PackReference,
    PackStatus, Principal, Role, StaticAuthorizationProvider,
    _content_hash,
)
from backend.tests.test_main_agent import intake, objective, services


ALL = frozenset(DisclosureSection)
PROJECT = frozenset({DisclosureSection.TRANSITION_PROJECT})


def accepted_run(*, partial=False, financed=True):
    cash = 220000 if financed else 400000
    goal = objective(funding={"mode": "FINANCE_IF_NEEDED" if financed else "CASH_ONLY", "grant_amount": 10000,
                              "terms": {"annual_interest_rate_pct": 4, "tenure_years": 7}})
    agent = MainAgent(services=services(cash=cash), assistant=Mock(explain=Mock(return_value=None)))
    config = {"configurable": {"thread_id": uuid4().hex}, "recursion_limit": 150}
    result = agent.invoke({"intake_result": intake("PARTIAL" if partial else "READY", cash=cash).model_dump(mode="json"),
                           "objective": goal.model_dump(mode="json")}, config)
    assert result["status"] == "HUMAN_REVIEW_REQUIRED", result
    return agent.invoke(Command(resume={"action": "ACCEPT", "actor": "SME Owner", "reason": "Review complete"}), config)


class LenderPackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.accepted = accepted_run()

    def setUp(self):
        self.state = deepcopy(self.accepted)
        self.repo = InMemoryPackRepository()
        self.identities = {
            "owner-session": Principal(subject_id="owner-123", role=Role.SME_OWNER, company_ids={"SME-TEST"}),
            "manager-session": Principal(subject_id="manager-123", role=Role.FINANCE_MANAGER, company_ids={"SME-TEST"}),
            "lender-session": Principal(subject_id="credit-123", role=Role.LENDER),
            "outsider-session": Principal(subject_id="outsider", role=Role.SME_OWNER, company_ids={"OTHER"}),
        }
        self.configure()

    def configure(self, state=None):
        self.service = LenderPackService(authorization=StaticAuthorizationProvider(self.identities),
            accepted_runs=InMemoryAcceptedRuns({"accepted-run": self.state if state is None else state}), repository=self.repo,
            versions=CalculationVersions(tools={"simulate_transition": "phase1-v1", "simulate_financing": "phase1-v1",
                                               "carbon_service": None, "finance_service": None}))

    def draft(self):
        return self.service.generate_draft("accepted-run", credential="manager-session")

    def grant(self, pack):
        self.identities["lender-session"] = Principal(subject_id="credit-123", role=Role.LENDER,
            lender_grants={(pack.pack_id, pack.version)})
        self.configure()

    def pending(self, pack=None, scope=ALL):
        pack = pack or self.draft()
        return self.service.request_disclosure_review(pack.reference, scope, credential="manager-session")

    def decide(self, pack, *, action=DisclosureAction.APPROVE_DISCLOSURE, credential="owner-session", scope=None, reference=None):
        return self.service.decide_disclosure(DisclosureDecision(reference=reference or pack.reference, action=action,
            sections=pack.requested_sections if scope is None else scope, reason="Explicit disclosure review"), credential=credential)

    def view(self, pack):
        return self.service.lender_view(pack.pack_id, pack.version, credential="lender-session")

    def test_accepted_run_generates_draft_with_exact_deterministic_values(self):
        pack = self.draft()
        self.assertEqual(pack.status, PackStatus.DRAFT)
        self.assertFalse(pack.shareable)
        self.assertFalse(pack.submittable)
        self.assertEqual(pack.version, 1)
        self.assertEqual(len(pack.content_hash), 64)
        self.assertIsNotNone(pack.created_at.tzinfo)
        selected = next(row for row in self.state["ranked_pathways"] if row["pathway"]["pathway_id"] == "SOLAR")
        self.assertEqual(pack.content.transition_project.capex, selected["pathway"]["capex"])
        self.assertEqual(pack.content.financing_request.monthly_repayment, selected["financing"]["monthly_repayment"])
        self.assertEqual(pack.content.financing_request.post_financing_dscr, selected["financing"]["post_financing_dscr"])
        self.assertEqual(pack.content.transition_kpis.remaining_cash, selected["pathway"]["remaining_cash"])
        self.assertEqual(pack.content.financing_request.capex, sum((pack.content.financing_request.sme_contribution,
            pack.content.financing_request.grant, pack.content.financing_request.financing_requested)))
        json.loads(pack.model_dump_json())

    def test_unaccepted_or_wrong_accepted_pathway_cannot_generate(self):
        for mutate in (lambda state: state.update(status="HUMAN_REVIEW_REQUIRED"),
                       lambda state: state["human_decision"].update(action="REJECT"),
                       lambda state: state["human_decision"].update(selected_pathway_id="LED")):
            state = deepcopy(self.state)
            mutate(state)
            self.configure(state)
            with self.assertRaises(ValueError):
                self.draft()

    def test_draft_and_pending_not_accessible_even_with_lender_grant(self):
        draft = self.draft()
        self.grant(draft)
        with self.assertRaises(PermissionError):
            self.view(draft)
        pending = self.pending(draft)
        with self.assertRaises(PermissionError):
            self.view(pending)

    def test_finance_manager_prepares_but_cannot_approve_or_reject(self):
        pending = self.pending()
        for action in DisclosureAction:
            with self.assertRaises(PermissionError):
                self.decide(pending, action=action, credential="manager-session")

    def test_owner_approval_and_rejection_are_explicit_and_audited(self):
        for action, status in ((DisclosureAction.APPROVE_DISCLOSURE, PackStatus.APPROVED),
                               (DisclosureAction.REJECT_DISCLOSURE, PackStatus.REJECTED)):
            pack = self.decide(self.pending(), action=action)
            self.assertEqual(pack.status, status)
            self.assertEqual(pack.shareable, status == PackStatus.APPROVED)
            self.assertEqual(pack.submittable, pack.shareable)
            self.assertEqual(pack.decision.subject_id, "owner-123")
            self.assertEqual(pack.decision.reference, pack.reference)
            self.assertEqual([event.event for event in pack.audit],
                             ["DRAFT_GENERATED", "DISCLOSURE_REVIEW_REQUESTED", action.value])
            self.assertEqual(pack.audit[0].subject_id, "manager-123")
            self.assertTrue(all(event.at.tzinfo for event in pack.audit))

    def test_lender_cannot_generate_review_approve_reject_or_get_internal(self):
        pack = self.pending()
        operations = [lambda: self.service.generate_draft("accepted-run", credential="lender-session"),
                      lambda: self.service.request_disclosure_review(pack.reference, ALL, credential="lender-session"),
                      lambda: self.service.get_internal(pack.reference, credential="lender-session")]
        operations += [lambda action=action: self.decide(pack, action=action, credential="lender-session")
                       for action in DisclosureAction]
        for operation in operations:
            with self.assertRaises(PermissionError):
                operation()

    def test_request_roles_and_names_do_not_authenticate(self):
        for credential in ("SME_OWNER", "SME Owner", "owner-123", {"role": "SME_OWNER"}):
            with self.assertRaises(PermissionError):
                self.service.generate_draft("accepted-run", credential=credential)
        with self.assertRaises(ValidationError):
            DisclosureDecision(reference=self.draft().reference, action="APPROVE_DISCLOSURE", sections=ALL,
                               reason="yes", role="SME_OWNER", actor="SME Owner")

    def test_cross_company_access_is_denied(self):
        pack = self.pending()
        with self.assertRaises(PermissionError):
            self.decide(pack, credential="outsider-session")
        with self.assertRaises(PermissionError):
            self.service.get_internal(pack.reference, credential="outsider-session")
        with self.assertRaises(PermissionError):
            self.service.generate_draft("accepted-run", credential="outsider-session")

    def test_approval_requires_exact_hash_version_and_scope(self):
        pack = self.pending()
        wrong_hash = pack.reference.model_copy(update={"content_hash": "0" * 64})
        with self.assertRaises(ValueError):
            self.decide(pack, reference=wrong_hash)
        with self.assertRaises((KeyError, ValueError)):
            self.decide(pack, reference=pack.reference.model_copy(update={"version": 999}))
        with self.assertRaises(ValueError):
            self.decide(pack, scope=PROJECT)
        with self.assertRaises(ValueError):
            self.decide(self.draft(), scope=ALL)

    def test_empty_scope_rejected(self):
        with self.assertRaises(ValueError):
            self.service.request_disclosure_review(self.draft().reference, frozenset(), credential="owner-session")

    def test_approved_snapshot_is_detached_and_terminal(self):
        pack = self.decide(self.pending())
        original = self.repo.get(pack.pack_id, pack.version).model_dump_json()
        with self.assertRaises(ValidationError):
            pack.status = PackStatus.DRAFT
        pack.content.transition_project.action_ids.append("MUTATED")
        pack.content.assumptions_limitations.warnings.append("MUTATED")
        self.assertFalse(pack.shareable)
        self.assertEqual(self.repo.get(pack.pack_id, pack.version).model_dump_json(), original)
        with self.assertRaises(ValueError):
            self.repo.save(pack)
        with self.assertRaises(ValueError):
            self.decide(self.repo.get(pack.pack_id, pack.version))

    def test_workspace_mutation_and_new_version_do_not_change_approved_snapshot(self):
        approved = self.decide(self.pending(scope=PROJECT))
        self.grant(approved)
        before = self.view(approved).model_dump_json()
        self.state["tool_results"]["get_financial_analysis"]["data"]["cash_balance"] = 999999
        self.configure()
        newer = self.service.generate_draft("accepted-run", pack_id=approved.pack_id, credential="manager-session")
        self.assertEqual(newer.version, 2)
        self.assertEqual(newer.status, PackStatus.DRAFT)
        self.assertNotEqual(newer.content_hash, approved.content_hash)
        self.assertEqual(self.view(approved).model_dump_json(), before)
        with self.assertRaises(PermissionError):
            self.view(newer)

    def test_disclosure_scope_filters_every_optional_section_and_hidden_fields(self):
        self.state.update(llm_explanation={"summary": "SECRET_REASONING"}, api_key="SECRET_KEY",
                          hidden_sme_data="SECRET_SME", errors=["SECRET_PROVIDER_DIAGNOSTIC"])
        self.configure()
        pack = self.decide(self.pending(scope=PROJECT))
        self.grant(pack)
        view = self.view(pack)
        self.assertEqual(set(view.sections), set(PROJECT))
        encoded = view.model_dump_json()
        for hidden in ("financial_summary", "cash_balance", "revenue", "remaining_cash", "post_financing_dscr",
                       "evidence_provenance", "provenance", "SECRET_", "execution_trace", "content_hash", "subject_id"):
            self.assertNotIn(hidden, encoded)
        self.assertNotIn("transition_kpis", encoded)

    def test_each_disclosure_section_can_be_explicitly_shared(self):
        for section in DisclosureSection:
            scope = frozenset({section})
            pack = self.decide(self.pending(scope=scope))
            self.grant(pack)
            self.assertEqual(set(self.view(pack).sections), scope)

    def test_no_grant_or_wrong_version_or_internal_role_can_read_lender_view(self):
        pack = self.decide(self.pending())
        for credential in ("lender-session", "owner-session", "manager-session"):
            with self.assertRaises(PermissionError):
                self.service.lender_view(pack.pack_id, pack.version, credential=credential)

    def test_rejected_pack_is_inaccessible(self):
        pack = self.decide(self.pending(), action=DisclosureAction.REJECT_DISCLOSURE)
        self.grant(pack)
        with self.assertRaises(PermissionError):
            self.view(pack)

    def test_partial_status_and_acceptance_warnings_survive_approval(self):
        self.state = accepted_run(partial=True)
        self.configure()
        pack = self.decide(self.pending(scope=PROJECT))
        self.assertEqual(pack.content.evidence_provenance.readiness["carbon_analysis"].status, "PARTIAL")
        self.assertTrue(pack.content.evidence_provenance.partial_evidence_accepted)
        self.assertTrue(any("PARTIAL" in item for item in pack.content.assumptions_limitations.warnings))
        self.grant(pack)
        self.assertIn("PARTIAL", self.view(pack).notice)

    def test_null_and_explicit_zero_preserved_without_fabricating_loan_terms(self):
        self.state = accepted_run(financed=False)
        self.state["intake_result"]["normalized_data"]["financial"]["revenue"] = None
        self.configure()
        pack = self.draft()
        self.assertIsNone(pack.content.financial_summary.revenue)
        self.assertEqual(pack.content.financing_request.financing_requested, 0)
        for field in ("monthly_repayment", "annual_interest_rate_pct", "tenure_years", "post_financing_dscr"):
            self.assertIsNone(getattr(pack.content.financing_request, field))

    def test_projected_and_unverified_labels_and_mock_status(self):
        pack = self.decide(self.pending())
        self.assertEqual(pack.content.transition_project.information_status, "PROJECTED")
        self.assertEqual(pack.content.financing_request.information_status, "PROJECTED")
        self.assertEqual(pack.content.carbon_impact.baseline_information_status, "REPORTED_UNVERIFIED")
        self.assertFalse(pack.content.evidence_provenance.externally_verified)
        self.assertTrue(pack.content.evidence_provenance.uses_test_doubles)
        self.grant(pack)
        self.assertEqual(self.view(pack).evidence_status, "MOCK_UNVERIFIED")
        self.assertIn("not lender approval", self.view(pack).notice)

    def test_tampered_content_or_hash_rejected(self):
        pack = self.draft()
        tampered = pack.model_copy(deep=True)
        # Frozen wrappers do not make nested lists immutable; trusted storage
        # must reject this detached object's changed content.
        tampered.content.transition_project.action_ids.append("FAKE")
        with self.assertRaises(ValueError):
            self.repo.save(tampered)
        with self.assertRaises(ValueError):
            self.repo.save(pack.model_copy(update={"content_hash": "0" * 64}))

    def test_storage_substitution_with_recomputed_hash_still_rejected_by_seal(self):
        pack = self.decide(self.pending())
        self.grant(pack)
        key = (pack.pack_id, pack.version)
        payload, seal = self.repo._records[key]
        data = json.loads(payload)
        data["content"]["transition_project"]["capex"] = 1
        changed_content = pack.content.model_copy(update={"transition_project":
            pack.content.transition_project.model_copy(update={"capex": 1})})
        data["content_hash"] = _content_hash(pack.pack_id, pack.version, pack.created_at, changed_content)
        data["decision"]["reference"]["content_hash"] = data["content_hash"]
        self.repo._records[key] = (json.dumps(data).encode(), seal)
        with self.assertRaises(ValueError):
            self.view(pack)

    def test_readiness_cannot_be_bypassed_by_accepted_label(self):
        self.state["intake_result"] = intake(blocked_module="carbon_analysis").model_dump(mode="json")
        self.configure()
        with self.assertRaises(ValueError):
            self.draft()

    def test_failed_or_unknown_critical_constraints_cannot_generate(self):
        for status in ("FAIL", "UNKNOWN"):
            state = deepcopy(self.state)
            row = next(item for item in state["ranked_pathways"] if item["pathway"]["pathway_id"] == "SOLAR")
            row["constraints"]["checks"][0]["status"] = status
            self.configure(state)
            with self.assertRaises(ValueError):
                self.draft()

    def test_cross_company_service_results_and_unreconciled_funding_are_rejected(self):
        state = deepcopy(self.state)
        state["tool_results"]["get_carbon_analysis"]["data"]["company_id"] = "OTHER"
        self.configure(state)
        with self.assertRaises(ValueError):
            self.draft()
        state = deepcopy(self.state)
        row = next(item for item in state["ranked_pathways"] if item["pathway"]["pathway_id"] == "SOLAR")
        row["pathway"]["capex"] += 100
        row["financing"]["capex"] += 100
        self.configure(state)
        with self.assertRaises(ValueError):
            self.draft()

    def test_unknown_or_overlapping_scope_names_are_not_accepted(self):
        with self.assertRaises(ValueError):
            self.service.request_disclosure_review(self.draft().reference, {"internal_reasoning"}, credential="owner-session")

    def test_approval_for_old_snapshot_cannot_approve_new_version(self):
        approved = self.decide(self.pending(scope=PROJECT))
        draft2 = self.service.generate_draft("accepted-run", pack_id=approved.pack_id, credential="owner-session")
        pending2 = self.pending(draft2, scope=PROJECT)
        with self.assertRaises(ValueError):
            self.decide(pending2, reference=PackReference(pack_id=pending2.pack_id, version=pending2.version,
                                                       content_hash=approved.content_hash))
        self.assertEqual(self.repo.get(pending2.pack_id, pending2.version).status, PackStatus.PENDING_DISCLOSURE_APPROVAL)

    def test_provenance_is_preserved_only_inside_authorized_evidence_section(self):
        evidence = {"field": "revenue", "source_file": "financial.csv", "source_document_id": "document-1",
                    "original_column": "Sales (RM)", "row": 2, "original_value": "300,000", "original_unit": "RM",
                    "normalized_value": 300000, "normalized_unit": "MYR", "reporting_period": "2024",
                    "extraction_method": "deterministic_csv", "mapping_method": "alias", "mapping_confidence": 1,
                    "evidence_quality": "INVOICE_DERIVED", "confirmation_status": "CONFIRMED", "confirmed_by": "owner-123"}
        self.state["intake_result"]["evidence"] = [evidence]
        self.configure()
        pack = self.decide(self.pending(scope=frozenset({DisclosureSection.EVIDENCE_PROVENANCE})))
        self.grant(pack)
        actual = self.view(pack).sections[DisclosureSection.EVIDENCE_PROVENANCE]["provenance"][0]
        for key, value in evidence.items():
            self.assertEqual(actual[key], value)
        self.assertFalse(actual["externally_verified"])


if __name__ == "__main__":
    unittest.main()
