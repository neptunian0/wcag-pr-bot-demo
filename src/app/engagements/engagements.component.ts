import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import type { Engagement } from './engagement.types';

@Component({
  selector: 'app-engagements',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule],
  templateUrl: './engagements.component.html',
  styleUrl: './engagements.component.scss'
})
export class EngagementsComponent {
  engagements: Engagement[] = [
    { id: 'ENG-104', client: 'Acme Industries Ltd',  status: 'active',   updated: '2026-05-06' },
    { id: 'ENG-091', client: 'Globex Holdings',      status: 'review',   updated: '2026-05-04' },
    { id: 'ENG-088', client: 'Initech Group',        status: 'active',   updated: '2026-04-29' },
    { id: 'ENG-073', client: 'Soylent Corp',         status: 'archived', updated: '2026-03-12' },
    { id: 'ENG-052', client: 'Umbrella Logistics',   status: 'review',   updated: '2026-02-18' }
  ];

  reportsAvailable = false;

  onCreate() {}
  onImport() {}
  onGenerateReport() {}
  onEdit(_eng: Engagement) {}
  onDelete(_eng: Engagement) {}
}
