import { Routes } from '@angular/router';
import { LevelerComponent } from './components/leveler/leveler.component';

export const routes: Routes = [
  { path: '', redirectTo: 'leveler', pathMatch: 'full' },
  {
    path: 'leveler',
    title: 'Leveler App',
    component: LevelerComponent,
  },
];
