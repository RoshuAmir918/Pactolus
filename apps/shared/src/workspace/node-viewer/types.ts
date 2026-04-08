export type ViewerNode = {
  id: string;
  index: number | null;
  type: string;
  label: string;
  createdAt: Date | null;
  parametersJson?: unknown;
};

export type ViewerCapture = {
  id: string;
  captureType: string;
  payloadJson: unknown;
  summaryText: string | null;
  createdAt: Date;
};

export type ViewerRegion = {
  address: string;
  sheetName?: string;
  regionType: "input" | "output";
  description?: string;
  reason?: string;
  colHeaders?: string[];
  rowHeaders?: string[];
  values: unknown[][];
};

export type ViewerNote = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  label?: string;
  placeholder?: string;
};

export type ViewerIconSet = {
  header?: React.ReactNode;
  operation?: React.ReactNode;
  savedAt?: React.ReactNode;
  note?: React.ReactNode;
  saved?: React.ReactNode;
  saveAction?: React.ReactNode;
  narrative?: React.ReactNode;
  loading?: React.ReactNode;
  regionInput?: React.ReactNode;
  regionOutput?: React.ReactNode;
  genericCapture?: React.ReactNode;
  expand?: (expanded: boolean) => React.ReactNode;
};
