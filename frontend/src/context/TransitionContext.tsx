// TransitionAI State & Operations Context
import { useDemoAuth } from '../auth/DemoAuth';
import { requirePermission } from '../auth/permissions';
import { useWorkspaceRoute } from '../auth/useWorkspaceRoute';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import {
  UserRole,
  TransitionTab,
  BusinessProfile,
  ActivityRecord,
  BankTransactionRecord,
  CarbonBaselineSummary,
  FinancialSummary,
  DecarbonisationAction,
  GreenLoanEligibility,
  LenderPackage,
  AuditLogEntry,
  UploadedFileInfo,
  StoredFinancialModel,
  WorkspaceStatus
} from '../types/transition';
import {
  calculate_carbon_baseline,
  get_financial_summary,
  generate_decarbonisation_actions,
  evaluate_green_loan_eligibility
} from '../utils/transitionCalculations';
import {
  PythonEngineStatus,
  checkPythonEngineHealth,
  executePythonFinancialComputation,
  uploadFileToPythonIngestion
} from '../utils/pythonEngineBridge';

interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isAiPowered?: boolean;
}

interface TransitionContextType {
  // Roles & Navigation
  currentRole: UserRole;
  activeTab: TransitionTab;
  setActiveTab: (tab: TransitionTab) => void;
  activeLenderToken: string | null;
  setActiveLenderToken: (token: string | null) => void;

  // Upload Context & Navigation
  uploadContext: 'full_business_data' | 'energy_emissions';
  setUploadContext: (ctx: 'full_business_data' | 'energy_emissions') => void;
  returnSourceSection: 'hero' | 'activity_evidence' | null;
  setReturnSourceSection: (sec: 'hero' | 'activity_evidence' | null) => void;
  navigateToUpload: (context: 'full_business_data' | 'energy_emissions', sourceSection?: 'hero' | 'activity_evidence') => void;
  inspectedFiles: any[];
  setInspectedFiles: React.Dispatch<React.SetStateAction<any[]>>;
  activeFileIndex: number;
  setActiveFileIndex: (idx: number) => void;

  // Data & State
  profile: BusinessProfile;
  updateProfile: (updates: Partial<BusinessProfile>) => Promise<void>;
  financialModel: StoredFinancialModel | null;
  updateFinancialModel: (model: StoredFinancialModel) => Promise<void>;
  activityRecords: ActivityRecord[];
  bankTransactions: BankTransactionRecord[];
  selectedActionIds: string[];
  toggleAction: (actionId: string) => Promise<void>;
  lenderPackages: LenderPackage[];
  auditLogs: AuditLogEntry[];
  uploadedFiles: UploadedFileInfo[];

  // Deterministic Computed Engines & Workspace Status
  baseline: CarbonBaselineSummary;
  financial: FinancialSummary;
  allActions: DecarbonisationAction[];
  selectedActions: DecarbonisationAction[];
  greenLoanEligibility: GreenLoanEligibility;
  workspaceStatus: WorkspaceStatus;

  // Operations
  isLoading: boolean;
  loadSampleData: () => Promise<void>;
  clearWorkspace: () => Promise<void>;
  refreshState: () => Promise<void>;
  inspectFiles: (files: File[]) => Promise<any[]>;
  confirmImport: (payload: {
    fileId: string;
    fileName: string;
    category: string;
    scope: string;
    mappedRecords: any[];
    ocrDocument?: any;
    isOcrParsed?: boolean;
  }) => Promise<any>;
  createLenderPackage: (packageName?: string, disclosures?: any, executiveSummaryText?: string) => Promise<LenderPackage>;

  // AI Copilot
  copilotMessages: CopilotMessage[];
  isCopilotLoading: boolean;
  sendCopilotMessage: (message: string) => Promise<void>;

  // Python Deterministic Engine Integration (Port 8000)
  pythonEngineStatus: PythonEngineStatus;
  isPythonSyncing: boolean;
  pythonLastResult: any;
  checkPythonEngine: () => Promise<PythonEngineStatus>;
  runPythonEngine: () => Promise<{ success: boolean; message: string; data?: any }>;
  uploadToPythonEngine: (file: File, sector?: string) => Promise<{ success: boolean; message: string; data?: any }>;
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined);

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useDemoAuth();
  if (!session) throw new Error('Sign in before opening a workspace');
  const currentRole = session.role;
  const [route, setActiveTab] = useWorkspaceRoute('overview');
  const activeTab = route as TransitionTab;
  const [activeLenderToken, setActiveLenderToken] = useState<string | null>(null);

  // Upload Context & Navigation
  const [uploadContext, setUploadContext] = useState<'full_business_data' | 'energy_emissions'>('full_business_data');
  const [returnSourceSection, setReturnSourceSection] = useState<'hero' | 'activity_evidence' | null>(null);
  const [inspectedFiles, setInspectedFiles] = useState<any[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  const navigateToUpload = (context: 'full_business_data' | 'energy_emissions', sourceSection?: 'hero' | 'activity_evidence') => {
    setUploadContext(context);
    if (sourceSection) {
      setReturnSourceSection(sourceSection);
    }
    setActiveTab('ingestion');
  };

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<BusinessProfile>({
    id: 'SME-USER-01',
    name: '',
    currency: 'MYR',
    reportingYear: 2024,
    industry: '',
    facilityLocation: 'Peninsular Malaysia',
    gridRegion: 'Peninsular Malaysia',
    facilityFloorAreaSqM: 0,
    employeeCount: 0,
    annualRevenue: 0,
    annualOperatingExpenses: 0,
    cashBalance: 0,
    existingAnnualDebtService: 0,
    emissionReductionTargetPct: 30,
    targetYear: 2030,
    maxCapExBudget: 500000,
    minDscrRequirement: 1.25,
    isConfigured: false
  });

  const [activityRecords, setActivityRecords] = useState<ActivityRecord[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransactionRecord[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>(['ACT-SOLAR-01', 'ACT-LED-02']);
  const [lenderPackages, setLenderPackages] = useState<LenderPackage[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [financialModel, setFinancialModel] = useState<StoredFinancialModel | null>(null);

  // Python Engine Integration State (Port 8000)
  const [pythonEngineStatus, setPythonEngineStatus] = useState<PythonEngineStatus>({
    connected: false,
    checking: true,
    backendUrl: 'http://127.0.0.1:8000'
  });
  const [isPythonSyncing, setIsPythonSyncing] = useState<boolean>(false);
  const [pythonLastResult, setPythonLastResult] = useState<any>(null);

  const checkPythonEngine = useCallback(async (): Promise<PythonEngineStatus> => {
    setPythonEngineStatus(prev => ({ ...prev, checking: true }));
    const status = await checkPythonEngineHealth();
    setPythonEngineStatus(status);
    return status;
  }, []);

  useEffect(() => {
    checkPythonEngine();
  }, [checkPythonEngine]);

  // Copilot messages
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'MSG-INIT',
      sender: 'assistant',
      text: "Hello! I'm TransitionAI, your AI Green Finance Copilot. I analyze your uploaded utility bills, fuel records, and financial statements to calculate an auditable carbon baseline, model financially viable decarbonisation interventions (such as rooftop solar or LED retrofits), and prepare a financing-ready transition pack for your lender. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAiPowered: true
    }
  ]);
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);

  // Fetch initial state from backend
  const refreshState = useCallback(async () => {
    requirePermission(currentRole, 'manage_data');
    try {
      setIsLoading(true);
      const data = await api.get<any>('/api/transition/state');
      if (data.profile) setProfile(data.profile);
      if (data.activityRecords) setActivityRecords(data.activityRecords);
      if (data.bankTransactions) setBankTransactions(data.bankTransactions);
      if (data.selectedActionIds) setSelectedActionIds(data.selectedActionIds);
      if (data.lenderPackages) setLenderPackages(data.lenderPackages);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.uploadedFiles) setUploadedFiles(data.uploadedFiles);
      if (data.financialModel !== undefined) setFinancialModel(data.financialModel);
    } catch (err) {
      console.error('[TransitionAI] Failed to fetch state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Update Profile
  const updateProfile = async (updates: Partial<BusinessProfile>) => {
    requirePermission(currentRole, 'manage_data');
    try {
      const json = await api.post<{ profile: BusinessProfile }>('/api/transition/profile', updates);
      setProfile(json.profile);
      await refreshState();
    } catch (err) {
      console.error('[TransitionAI] Update profile failed:', err);
    }
  };

  // Update Financial Model
  const updateFinancialModel = async (model: StoredFinancialModel) => {
    requirePermission(currentRole, 'manage_data');
    try {
      await api.post('/api/transition/financial-model', model);
      setFinancialModel(model);
      await refreshState();
    } catch (err) {
      console.error('[TransitionAI] Update financial model failed:', err);
    }
  };

  // Clear workspace to clean state
  const clearWorkspace = async () => {
    requirePermission(currentRole, 'manage_data');
    try {
      setIsLoading(true);
      await api.post('/api/transition/clear');
      await refreshState();
    } catch (err) {
      console.error('[TransitionAI] Clear failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load realistic sample data
  const loadSampleData = async () => {
    requirePermission(currentRole, 'manage_data');
    try {
      setIsLoading(true);
      await api.post('/api/transition/load-sample');
      await refreshState();
    } catch (err) {
      console.error('[TransitionAI] Load sample failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle decarbonisation action
  const toggleAction = async (actionId: string) => {
    requirePermission(currentRole, 'select_actions');
    try {
      const json = await api.post<{ selectedActionIds: string[] }>('/api/transition/action/toggle', { actionId });
      setSelectedActionIds(json.selectedActionIds);
    } catch (err) {
      console.error('[TransitionAI] Toggle action failed:', err);
    }
  };

  // Inspect uploaded files
  const inspectFiles = async (files: File[]) => {
    requirePermission(currentRole, 'manage_data');
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const json = await api.post<{ files?: any[]; inspectedFiles?: any[] }>('/api/transition/upload/inspect', formData);
    return json.files || json.inspectedFiles || [];
  };

  // Confirm mapped records import
  const confirmImport = async (payload: {
    fileId: string;
    fileName: string;
    category: string;
    scope: string;
    mappedRecords: any[];
    ocrDocument?: any;
    isOcrParsed?: boolean;
  }) => {
    requirePermission(currentRole, 'manage_data');
    const json = await api.post<any>('/api/transition/upload/confirm', payload);
    await refreshState();
    return json;
  };

  // Create shared lender package
  const createLenderPackage = async (packageName?: string, disclosures?: any, executiveSummaryText?: string): Promise<LenderPackage> => {
    requirePermission(currentRole, 'approve_disclosure');
    const json = await api.post<{ package: LenderPackage }>('/api/transition/lender-package/create', { packageName, disclosures, executiveSummaryText });
    await refreshState();
    return json.package;
  };

  // Send message to AI Copilot
  const sendCopilotMessage = async (message: string) => {
    requirePermission(currentRole, 'ask_copilot');
    if (!message.trim()) return;

    const userMsg: CopilotMessage = {
      id: `USER-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setCopilotMessages((prev) => [...prev, userMsg]);
    setIsCopilotLoading(true);

    try {
      const json = await api.post<{ reply: string; aiPowered?: boolean }>('/api/transition/copilot/chat', { message, currentRole });
      const aiMsg: CopilotMessage = {
        id: `AI-${Date.now()}`,
        sender: 'assistant',
        text: json.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAiPowered: json.aiPowered
      };
      setCopilotMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const fallbackMsg: CopilotMessage = {
        id: `AI-${Date.now()}`,
        sender: 'assistant',
        text: "I experienced a connection issue reaching the AI model, but your deterministic carbon baseline and financial metrics remain fully operational. You can review your Scope 1 & 2 figures and DSCR in the respective dashboard tabs.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAiPowered: false
      };
      setCopilotMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsCopilotLoading(false);
    }
  };

  // Python Engine Action Methods
  const runPythonEngine = async (): Promise<{ success: boolean; message: string; data?: any }> => {
    requirePermission(currentRole, 'manage_data');
    setIsPythonSyncing(true);
    try {
      const result = await executePythonFinancialComputation(profile);
      if (result.success && result.model) {
        setPythonLastResult(result.raw);
        setFinancialModel(result.model);
        await updateFinancialModel(result.model);
        await refreshState();
        return {
          success: true,
          message: 'Financial statements & DSCR successfully computed via Python FastAPI.',
          data: result.raw
        };
      }
      return {
        success: false,
        message: result.error || 'Failed to compute via Python engine'
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    } finally {
      setIsPythonSyncing(false);
    }
  };

  const uploadToPythonEngine = async (file: File, sector?: string): Promise<{ success: boolean; message: string; data?: any }> => {
    requirePermission(currentRole, 'manage_data');
    setIsLoading(true);
    try {
      const res = await uploadFileToPythonIngestion(file, sector || 'total', profile.reportingYear || 2024);
      if (res.success) {
        await refreshState();
        return {
          success: true,
          message: `File parsed and evaluated by Python intake engine!`,
          data: res.data
        };
      }
      return {
        success: false,
        message: res.error || 'Upload to Python intake failed'
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Deterministic calculations
  const baseline = useMemo(() => {
    return calculate_carbon_baseline(activityRecords, profile);
  }, [activityRecords, profile]);

  const financial = useMemo(() => {
    return get_financial_summary(profile, activityRecords, bankTransactions);
  }, [profile, activityRecords, bankTransactions]);

  const allActions = useMemo(() => {
    return generate_decarbonisation_actions(baseline, financial, profile);
  }, [baseline, financial, profile]);

  const selectedActions = useMemo(() => {
    return allActions.filter((a) => selectedActionIds.includes(a.id));
  }, [allActions, selectedActionIds]);

  const greenLoanEligibility = useMemo(() => {
    return evaluate_green_loan_eligibility(baseline, financial, profile, selectedActions);
  }, [baseline, financial, profile, selectedActions]);

  const workspaceStatus: WorkspaceStatus = useMemo(() => {
    return {
      workspaceId: profile.id,
      companyName: profile.name || 'SME Workspace',
      reportingPeriod: `FY${profile.reportingYear}`,
      currency: profile.currency,
      totalSourceFiles: uploadedFiles.length,
      totalActivityRecords: activityRecords.length,
      totalTransactions: bankTransactions.length,
      hasFinancialStatements: !!financialModel || profile.annualRevenue > 0,
      hasCarbonBaseline: baseline.totalTCO2e > 0,
      hasDecarbonisationPlan: selectedActions.length > 0,
      isLenderPackReady: lenderPackages.length > 0 || (baseline.totalTCO2e > 0 && profile.annualRevenue > 0),
      lastDataUpdate: profile.lastUpdated || new Date().toISOString(),
      lastCalculation: new Date().toISOString()
    };
  }, [profile, uploadedFiles.length, activityRecords.length, bankTransactions.length, financialModel, baseline.totalTCO2e, selectedActions.length, lenderPackages.length]);

  return (
    <TransitionContext.Provider
      value={{
        currentRole,
        activeTab,
        setActiveTab,
        activeLenderToken,
        setActiveLenderToken,
        uploadContext,
        setUploadContext,
        returnSourceSection,
        setReturnSourceSection,
        navigateToUpload,
        inspectedFiles,
        setInspectedFiles,
        activeFileIndex,
        setActiveFileIndex,
        profile,
        updateProfile,
        financialModel,
        updateFinancialModel,
        activityRecords,
        bankTransactions,
        selectedActionIds,
        toggleAction,
        lenderPackages,
        auditLogs,
        uploadedFiles,
        baseline,
        financial,
        allActions,
        selectedActions,
        greenLoanEligibility,
        workspaceStatus,
        isLoading,
        loadSampleData,
        clearWorkspace,
        refreshState,
        inspectFiles,
        confirmImport,
        createLenderPackage,
        copilotMessages,
        isCopilotLoading,
        sendCopilotMessage,
        pythonEngineStatus,
        isPythonSyncing,
        pythonLastResult,
        checkPythonEngine,
        runPythonEngine,
        uploadToPythonEngine
      }}
    >
      {children}
    </TransitionContext.Provider>
  );
};

export const useTransition = (): TransitionContextType => {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within a TransitionProvider');
  }
  return context;
};
