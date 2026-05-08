import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CheckboxModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  email = '';
  emailTouched = false;
  prefs = { weeklyDigest: true, productUpdates: false, billing: true };
  showInviteModal = false;

  get emailIsInvalid(): boolean {
    if (!this.emailTouched) return false;
    if (!this.email) return true;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  openInviteModal() {
    this.showInviteModal = true;
  }

  closeInviteModal() {
    this.showInviteModal = false;
  }

  onSave() {}
}
