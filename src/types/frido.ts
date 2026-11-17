export type MatchStatus = "confirmed" | "needs_review" | "conflict" | "unmatched";

export type MatchType =
  | "exact_approved_mapping"
  | "exact_identifier"
  | "approved_family"
  | "attribute_candidate"
  | "no_reference";

export type ExtractionStatus = "extracted" | "needs_attention" | "conflicted";

export type BatchStatus = "completed" | "in_review" | "processing" | "failed";

export type ReportType =
  | "approved_only"
  | "complete_report"
  | "batch_summary"
  | "conflict_report"
  | "review_report";

export type ReviewActionType =
  | "approved"
  | "rejected"
  | "kept_for_later"
  | "flagged_conflict"
  | "system_classified"
  | "marked_unmatched";

export interface Product {
  id: string;
  productCode: string;
  name: string;
  description?: string;
  categoryCode?: string;
  scanIdentifier?: string;
  brand: string;
  color?: string;
  size?: string;
  dimensions?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
  weightG?: string;
  basePrice?: number;
  costPrice?: number;
  mrp: number;
  enabled?: boolean;
  type?: string;
  componentProductCode?: string;
  catalogCategory?: string;
  skuFamily?: string;
}

export interface StickerReference {
  id: string;
  documentId: string;
  documentName: string;
  documentSource: "uploaded" | "seed_demo";
  stickerIdentifier: string;
  productName: string;
  commonName?: string;
  netQuantity?: string;
  dimensions?: string;
  manufacturingMonthYear?: string;
  batchNumber?: string;
  packagedBy?: string;
  marketedBy?: string;
  countryOfOrigin?: string;
  mrp?: number;
  customerCareDetails?: string;
  colorVariant?: string;
  sizeVariant?: string;
  category?: string;
  familyKey?: string;
  missingFields: string[];
  extractionStatus: ExtractionStatus;
  extractionNote?: string;
  lastUpdated: string;
}

export interface MatchEvidence {
  id: string;
  code?: string;
  type: "positive" | "warning" | "conflict" | "neutral";
  title: string;
  detail: string;
}

export interface AttributeComparisonRow {
  attribute: string;
  csvValue?: string | null;
  stickerValue?: string | null;
  alignment: "match" | "differs" | "missing" | "conflict";
}

export interface ReviewAction {
  id: string;
  reviewer: string;
  action: ReviewActionType;
  previousStatus: MatchStatus | "new";
  newStatus: MatchStatus;
  timestamp: string;
  note?: string;
  selectedStickerIdentifier?: string;
}

export interface MatchResult {
  id: string;
  batchId: string;
  product: Product;
  matchedSticker: StickerReference | null;
  candidateStickers: StickerReference[];
  matchType: MatchType;
  status: MatchStatus;
  matchingRuleApplied: string;
  ruleId: string;
  engineVersion: string;
  reviewReason?: string;
  conflictWarnings: string[];
  evidence: MatchEvidence[];
  attributeComparisons: AttributeComparisonRow[];
  reviewHistory: ReviewAction[];
  reviewState: "pending" | "approved" | "rejected" | "deferred";
  reviewedByName?: string;
  reviewedAt?: string;
  lastUpdated: string;
}

export interface ItemMasterBatch {
  id: string;
  uuid: string;
  csvFilename: string;
  uploadDate: string;
  uploadedBy: string;
  totalProducts: number;
  validRows: number;
  invalidRows: number;
  confirmedCount: number;
  needsReviewCount: number;
  conflictCount: number;
  unmatchedCount: number;
  status: BatchStatus;
  processingStatus: "queued" | "processing" | "completed" | "failed";
  engineVersion: string;
  errorMessage?: string;
  isDemoSeed?: boolean;
  notes?: string;
  fileSize?: number;
}

export interface Report {
  id: string;
  uuid: string;
  batchId: string;
  csvFilename: string;
  generatedDate: string;
  generatedBy: string;
  reportType: ReportType;
  productCount: number;
  confirmedCount: number;
  needsReviewCount: number;
  conflictCount: number;
  unmatchedCount: number;
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  batchId?: string;
}

export interface SessionProfile {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  role: "super_admin" | "employee";
}

export interface UserPreferences {
  tableDensity: "comfortable" | "compact";
  defaultPageSize: 10 | 20 | 50;
  showDemoBanner: boolean;
  emailDigestEnabled: boolean;
  conflictAlertsEnabled: boolean;
  displayName: string;
  roleTitle: string;
  email: string;
}
