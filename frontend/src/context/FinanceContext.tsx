import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  AuditLogEntry,
  Bill,
  BusinessProfile,
  CashAlert,
  CashProjectionPoint,
  Invoice,
  ProposedAction,
  ScenarioPlan,
  PlanId,
  UploadedFileRecord,
  BankTransaction
} from '../types/finance';
import {
  EMPTY_BUSINESS_PROFILE,
  INITIAL_INVOICES,
  INITIAL_BILLS,
  INITIAL_AUDIT_LOGS
} from '../data/seedData';
import {
  buildRealDataScenarios,
  evaluateCashRisks,
  formatMYR,
  generateCashForecast
} from '../utils/financeCalculations';

export type NavigationTab =
  | 'dashboard'
  | 'diagnosis'
  | 'scenarios'
  | 'actions'
  | 'copilot'
  | 'timeline'
  | 'audit'
  | 'data-setup';

interface FinanceContextType {
  businessProfile: BusinessProfile;
  invoices: Invoice[];
  bills: Bill[];
  bankTransactions: BankTransaction[];
  uploadedFiles: UploadedFileRecord[];
  auditLogs: AuditLogEntry[];
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  isLoading: boolean;
  isDataLoaded: boolean;

  // Forecast & Metrics
  forecastHorizonDays: number;
  setForecastHorizonDays: (days: number) => void;
  forecast: CashProjectionPoint[];
  currentAlert: CashAlert;
  candidatePlans: ScenarioPlan[];
  selectedPlanId: PlanId;
  setSelectedPlanId: (id: PlanId) => void;

  // Plan Adjusters
  planACollectionDay: number;
  setPlanACollectionDay: (day: number) => void;
  planBExtensionDays: number;
  setPlanBExtensionDays: (days: number) => void;
  planCCutSen: number;
  setPlanCCutSen: (sen: number) => void;

  // Actions
  proposedActions: ProposedAction[];
  approveAction: (actionId: string) => void;
  rejectAction: (actionId: string, reason?: string) => void;
  updateActionDraft: (actionId: string, subject: string, body: string) => void;
  executeSimulatedAction: (actionId: string) => Promise<{ success: boolean; message: string }>;
  isSimulatingAction: boolean;

  // Onboarding
  showOnboarding: boolean;
  setShowOnboarding: (val: boolean) => void;

  // Real Payment Reconciling & Simulation
  recordPayment: (invoiceId: string, amountSen?: number) => Promise<{ success: boolean; message: string }>;
  isRecordingPayment: boolean;
  hasSimulatedPayment: boolean;
  simulatedPaymentMeta: { invoiceId: string; customerName: string; amountSen: number; paidAt: string } | null;
  isSimulatingPayment: boolean;
  simulateCustomerPayment: (invoiceId?: string) => Promise<{ success: boolean; message: string }>;

  // Data & Profile Actions
  refreshData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  resetDemo: () => Promise<void>;
  updateSettings: (updates: Partial<BusinessProfile>) => Promise<void>;
  updateBusinessProfile: (updates: Partial<BusinessProfile>) => Promise<void>;

  // System
  geminiActive: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(EMPTY_BUSINESS_PROFILE);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [bills, setBills] = useState<Bill[]>(INITIAL_BILLS);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [activeTab, setActiveTab] = useState<NavigationTab>('data-setup'); // Starts at upload if empty
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [forecastHorizonDays, setForecastHorizonDays] = useState<number>(30);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('PLAN_A');
  const [planACollectionDay, setPlanACollectionDay] = useState<number>(5);
  const [planBExtensionDays, setPlanBExtensionDays] = useState<number>(14);
  const [planCCutSen, setPlanCCutSen] = useState<number>(100000);

  const [isSimulatingAction, setIsSimulatingAction] = useState<boolean>(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState<boolean>(false);
  const [geminiActive, setGeminiActive] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState<boolean>(false);
  const [simulatedPaymentMeta, setSimulatedPaymentMeta] = useState<{
    invoiceId: string;
    customerName: string;
    amountSen: number;
    paidAt: string;
  } | null>(null);

  // Load persistent financial data from server
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<any>('/api/financial-data');
      if (data.profile) {
        setBusinessProfile(data.profile);
        if (data.profile.forecastHorizonDays) {
          setForecastHorizonDays(data.profile.forecastHorizonDays);
        }
      }
      if (Array.isArray(data.invoices)) setInvoices(data.invoices);
      if (Array.isArray(data.bills)) setBills(data.bills);
      if (Array.isArray(data.bankTransactions)) setBankTransactions(data.bankTransactions);
      if (Array.isArray(data.uploadedFiles)) setUploadedFiles(data.uploadedFiles);
      if (Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
        setAuditLogs(data.auditLogs);
      }

      const hasAnyData = (data.invoices?.length > 0) || (data.bills?.length > 0) || data.profile?.isConfigured;
      if (hasAnyData) {
        setActiveTab('dashboard');
      } else {
        setActiveTab('data-setup');
      }
    } catch (err) {
      console.warn('[FinanceContext] Error fetching server data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    api.get<{ geminiActive?: boolean }>('/api/health')
      .then((data) => {
        if (data.geminiActive) setGeminiActive(true);
      })
      .catch(() => setGeminiActive(false));
  }, [refreshData]);

  const isDataLoaded = businessProfile.isConfigured || invoices.length > 0 || bills.length > 0;

  // Compute active forecast deterministically using strictly uploaded records
  const forecast = useMemo(() => {
    if (!isDataLoaded) return [];
    return generateCashForecast({
      initialCashSen: businessProfile.initialCashSen || 0,
      minReserveSen: businessProfile.minReserveSen || 0,
      forecastHorizonDays,
      bills,
      invoices
    });
  }, [
    isDataLoaded,
    businessProfile.initialCashSen,
    businessProfile.minReserveSen,
    forecastHorizonDays,
    bills,
    invoices
  ]);

  // Cash alert evaluated strictly from active forecast and real records
  const currentAlert = useMemo(() => {
    return evaluateCashRisks(
      forecast,
      businessProfile.minReserveSen || 0,
      bills,
      invoices,
      businessProfile.isConfigured
    );
  }, [forecast, businessProfile.minReserveSen, bills, invoices, businessProfile.isConfigured]);

  // Compute candidate plans based on real uploaded data
  const candidatePlans = useMemo(() => {
    if (!isDataLoaded || (bills.length === 0 && invoices.length === 0)) return [];
    return buildRealDataScenarios(
      {
        initialCashSen: businessProfile.initialCashSen || 0,
        minReserveSen: businessProfile.minReserveSen || 0,
        forecastHorizonDays,
        bills,
        invoices
      },
      planACollectionDay,
      planBExtensionDays,
      planCCutSen
    );
  }, [
    isDataLoaded,
    businessProfile.initialCashSen,
    businessProfile.minReserveSen,
    forecastHorizonDays,
    bills,
    invoices,
    planACollectionDay,
    planBExtensionDays,
    planCCutSen
  ]);

  // Actions initialized from selected plan
  const [proposedActions, setProposedActions] = useState<ProposedAction[]>([]);

  useEffect(() => {
    const currentPlan = candidatePlans.find((p) => p.id === selectedPlanId) || candidatePlans[0];
    if (currentPlan) {
      setProposedActions((prev) => {
        return currentPlan.actions.map((act) => {
          const existing = prev.find((p) => p.id === act.id);
          return existing ? { ...act, status: existing.status, draftMessageSubject: existing.draftMessageSubject, draftMessageBody: existing.draftMessageBody } : act;
        });
      });
    } else {
      setProposedActions([]);
    }
  }, [selectedPlanId, candidatePlans]);

  // Approve action handler
  const approveAction = (actionId: string) => {
    const now = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    setProposedActions((prev) =>
      prev.map((act) =>
        act.id === actionId
          ? { ...act, status: 'Approved', approvedDate: now }
          : act
      )
    );

    const targetAction = proposedActions.find((a) => a.id === actionId);
    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: now,
      stepNumber: 5,
      stage: 'Approval Recorded',
      summary: `Owner authorized: ${targetAction?.title || actionId}`,
      detail: `Explicit authorization recorded for ${targetAction?.targetEntity || 'party'}. Parameter locked: ${formatMYR(targetAction?.amountSen || 0)}.`,
      actor: 'Business Owner (You)',
      statusBadge: 'completed'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Reject action handler
  const rejectAction = (actionId: string, reason = 'Owner decision') => {
    setProposedActions((prev) =>
      prev.map((act) =>
        act.id === actionId
          ? { ...act, status: 'Rejected', rejectionReason: reason }
          : act
      )
    );

    const now = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const newLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: now,
      stepNumber: 5,
      stage: 'Action Rejected',
      summary: `Owner rejected action ${actionId}`,
      detail: `Reason: "${reason}". Action will not be executed.`,
      actor: 'Business Owner (You)',
      statusBadge: 'flagged'
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Update action draft with re-approval enforcement
  const updateActionDraft = (actionId: string, subject: string, body: string) => {
    setProposedActions((prev) =>
      prev.map((act) =>
        act.id === actionId
          ? {
              ...act,
              draftMessageSubject: subject,
              draftMessageBody: body,
              status: 'Pending Approval',
              approvedDate: undefined
            }
          : act
      )
    );

    const now = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const editLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: now,
      stepNumber: 4,
      stage: 'Draft Modified',
      summary: `Draft terms modified for action ${actionId}`,
      detail: 'Parameters changed by user; explicit re-approval required before execution.',
      actor: 'Business Owner (You)',
      statusBadge: 'pending'
    };
    setAuditLogs((prev) => [editLog, ...prev]);
  };

  // Execute simulated action with strict approval validation
  const executeSimulatedAction = async (actionId: string): Promise<{ success: boolean; message: string }> => {
    const targetAction = proposedActions.find((a) => a.id === actionId);
    if (!targetAction) return { success: false, message: 'Action not found.' };

    if (targetAction.status !== 'Approved') {
      return {
        success: false,
        message: `Approval Required: Action "${targetAction.title}" has status "${targetAction.status}". Explicit owner approval is required before execution.`
      };
    }

    setIsSimulatingAction(true);
    await new Promise((r) => setTimeout(r, 900));

    const now = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const dispatchId = `CP-SIM-${Math.floor(1000 + Math.random() * 9000)}`;

    setProposedActions((prev) =>
      prev.map((act) =>
        act.id === actionId
          ? {
              ...act,
              status: 'Executed',
              executedDate: now,
              executionReceipt: {
                channel: 'Simulated Notification Gateway',
                dispatchId,
                sentAt: now,
                verified: true
              }
            }
          : act
      )
    );

    const execLog: AuditLogEntry = {
      id: `LOG-${Date.now()}`,
      timestamp: now,
      stepNumber: 6,
      stage: 'Action Executed (Simulation)',
      summary: `Executed simulated delivery of ${targetAction.title}`,
      detail: `Simulated dispatch to ${targetAction.targetEntity}. Receipt ID: #${dispatchId}.`,
      actor: 'CashPilot AI Agent',
      statusBadge: 'completed'
    };

    setAuditLogs((prev) => [execLog, ...prev]);
    setIsSimulatingAction(false);

    return {
      success: true,
      message: `Action dispatched in simulation (ID: #${dispatchId}).`
    };
  };

  // Record real customer payment and reconcile invoice
  const recordPayment = async (invoiceId: string, amountSen?: number): Promise<{ success: boolean; message: string }> => {
    setIsRecordingPayment(true);
    try {
      const data = await api.post<{ error?: string; invoice?: { amountSen: number; id: string } }>('/api/financial-data/record-payment', { invoiceId, amountSen });
      await refreshData();
      return {
        success: true,
        message: `Payment of ${formatMYR(data.invoice?.amountSen ?? 0)} reconciled for ${data.invoice?.id ?? invoiceId}. Available cash balance updated.`
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Payment recording failed.' };
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Clear all data and reset to clean empty state
  const clearAllData = async () => {
    try {
      await api.del('/api/financial-data');
      setBusinessProfile(EMPTY_BUSINESS_PROFILE);
      setInvoices([]);
      setBills([]);
      setBankTransactions([]);
      setUploadedFiles([]);
      setAuditLogs([]);
      setProposedActions([]);
      setActiveTab('data-setup');
    } catch (err) {
      console.error('Failed to clear data:', err);
    }
  };

  // Update profile settings
  const updateSettings = async (updates: Partial<BusinessProfile>) => {
    try {
      const data = await api.post<{ profile: BusinessProfile }>('/api/financial-data/settings', updates);
      setBusinessProfile(data.profile);
      if (updates.forecastHorizonDays) {
        setForecastHorizonDays(updates.forecastHorizonDays);
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  // Simulated payment detection
  const hasSimulatedPayment = useMemo(() => {
    return invoices.some((i) => i.status === 'paid' && i.simulatedPaidDate) || !!simulatedPaymentMeta;
  }, [invoices, simulatedPaymentMeta]);

  // Simulate customer payment settlement with reforecast
  const simulateCustomerPayment = async (targetInvoiceId?: string): Promise<{ success: boolean; message: string }> => {
    setIsSimulatingPayment(true);
    try {
      const inv = invoices.find((i) => (targetInvoiceId ? i.id === targetInvoiceId : (i.status === 'overdue' || i.status !== 'paid'))) || invoices[0];
      const invId = inv ? inv.id : (targetInvoiceId || 'INV-1042');
      const amount = inv ? inv.amountSen : 1200000;
      const custName = inv ? inv.customerName : 'MegaRetail Sdn Bhd';

      const res = await recordPayment(invId, amount);
      if (res.success) {
        const now = new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
        setSimulatedPaymentMeta({
          invoiceId: invId,
          customerName: custName,
          amountSen: amount,
          paidAt: now
        });
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Payment simulation failed.' };
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  const updateBusinessProfile = async (updates: Partial<BusinessProfile>) => {
    await updateSettings(updates);
  };

  const resetDemo = async () => {
    await clearAllData();
  };

  return (
    <FinanceContext.Provider
      value={{
        businessProfile,
        invoices,
        bills,
        bankTransactions,
        uploadedFiles,
        auditLogs,
        activeTab,
        setActiveTab,
        isLoading,
        isDataLoaded,
        showOnboarding,
        setShowOnboarding,
        forecastHorizonDays,
        setForecastHorizonDays,
        forecast,
        currentAlert,
        candidatePlans,
        selectedPlanId,
        setSelectedPlanId,
        planACollectionDay,
        setPlanACollectionDay,
        planBExtensionDays,
        setPlanBExtensionDays,
        planCCutSen,
        setPlanCCutSen,
        proposedActions,
        approveAction,
        rejectAction,
        updateActionDraft,
        executeSimulatedAction,
        isSimulatingAction,
        recordPayment,
        isRecordingPayment,
        hasSimulatedPayment,
        simulatedPaymentMeta,
        isSimulatingPayment,
        simulateCustomerPayment,
        refreshData,
        clearAllData,
        resetDemo,
        updateSettings,
        updateBusinessProfile,
        geminiActive
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
