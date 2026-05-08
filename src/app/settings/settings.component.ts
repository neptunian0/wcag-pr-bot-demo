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
  notificationEmail = '';
  notificationEmailTouched = false;
  prefs = { weeklyDigest: true, productUpdates: false, billing: true };
  showInviteModal = false;

  private static readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  get emailIsInvalid(): boolean {
    if (!this.emailTouched) return false;
    if (!this.email) return true;
    return !SettingsComponent.EMAIL_RE.test(this.email);
  }

  get notificationEmailIsInvalid(): boolean {
    if (!this.notificationEmailTouched) return false;
    if (!this.notificationEmail) return true;
    return !SettingsComponent.EMAIL_RE.test(this.notificationEmail);
  }

  openInviteModal() {
    this.showInviteModal = true;
  }

  closeInviteModal() {
    this.showInviteModal = false;
  }

  onSave() {}
}
