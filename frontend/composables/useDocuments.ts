import type { LabelFormat, LabelSymbology } from '@lims/shared';

export function useDocuments() {
  const api = useApi();

  async function openBlob(path: string): Promise<void> {
    const preview = import.meta.client ? window.open('', '_blank') : null;
    try {
      const blob = await api.blob(path);
      const url = URL.createObjectURL(blob);
      if (preview) {
        preview.location.href = url;
      } else if (import.meta.client) {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      preview?.close();
      throw error;
    }
  }

  async function download(path: string, filename: string): Promise<void> {
    const blob = await api.blob(path);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function openReportPdf(reportId: string): Promise<void> {
    await openBlob(`/reports/${reportId}/pdf`);
  }

  async function openCaseLabels(
    caseId: string,
    include: 'all' | 'specimens' | 'blocks' | 'slides' = 'all',
    symbology: LabelSymbology = 'datamatrix',
  ): Promise<void> {
    await openBlob(`/labels/case/${caseId}?format=pdf&include=${include}&symbology=${symbology}`);
  }

  async function openLabel(
    entityType: 'specimen' | 'block' | 'slide',
    id: string,
    format: LabelFormat = 'pdf',
    symbology: LabelSymbology = 'datamatrix',
  ): Promise<void> {
    await openBlob(`/labels/${entityType}/${id}?format=${format}&symbology=${symbology}`);
  }

  async function downloadCaseLabels(
    caseId: string,
    accessionNumber: string,
    format: LabelFormat = 'pdf',
    include: 'all' | 'specimens' | 'blocks' | 'slides' = 'all',
  ): Promise<void> {
    const extension = format === 'zpl' ? 'zpl' : format;
    await download(
      `/labels/case/${caseId}?format=${format}&include=${include}`,
      `${accessionNumber}-labels.${extension}`,
    );
  }

  return {
    openBlob,
    download,
    openReportPdf,
    openCaseLabels,
    openLabel,
    downloadCaseLabels,
  };
}
