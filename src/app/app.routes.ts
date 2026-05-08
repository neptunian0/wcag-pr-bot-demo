import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { EngagementsComponent } from './engagements/engagements.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'engagements', component: EngagementsComponent },
  { path: 'settings', component: SettingsComponent }
];
