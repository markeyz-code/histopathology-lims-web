import type {
  Block,
  CaseDetail,
  CaseListItem,
  CutSlidesInput,
  GrossBlockInput,
  Paginated,
  Slide,
  Specimen,
  StainRequestInput,
  UserSummary,
  AccessionInput,
} from '@lims/shared';

export function useCases() {
  const api = useApi();

  return {
    list(
      query: Record<string, string | number | boolean | undefined>,
    ): Promise<Paginated<CaseListItem>> {
      return api.get<Paginated<CaseListItem>>('/cases', query);
    },
    get(id: string): Promise<CaseDetail> {
      return api.get<CaseDetail>(`/cases/${id}`);
    },
    accession(input: AccessionInput): Promise<CaseDetail> {
      return api.post<CaseDetail>('/cases/accession', input);
    },
    assign(caseId: string, pathologistId: string | null): Promise<CaseDetail> {
      return api.patch<CaseDetail>(`/cases/${caseId}/assign`, { pathologistId });
    },
    update(caseId: string, patch: object): Promise<CaseDetail> {
      return api.patch<CaseDetail>(`/cases/${caseId}`, patch);
    },
    gross(input: GrossBlockInput): Promise<Block[]> {
      return api.post<Block[]>('/blocks/gross', input);
    },
    cut(input: CutSlidesInput): Promise<Slide[]> {
      return api.post<Slide[]>('/slides/cut', input);
    },
    requestStain(input: StainRequestInput): Promise<Slide> {
      return api.post<Slide>('/slides/request', input);
    },
    recut(slideId: string, reason: string): Promise<Slide> {
      return api.post<Slide>(`/slides/${slideId}/recut`, { reason });
    },
    rejectSpecimen(specimenId: string, reason: string): Promise<Specimen> {
      return api.post<Specimen>(`/specimens/${specimenId}/reject`, { reason });
    },
    pathologists(): Promise<UserSummary[]> {
      return api.get<UserSummary[]>('/users/pathologists');
    },
  };
}
