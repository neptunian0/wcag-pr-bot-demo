export type EngagementStatus = 'active' | 'review' | 'archived';

export interface Engagement {
  id: string;
  client: string;
  status: EngagementStatus;
  updated: string;
}
