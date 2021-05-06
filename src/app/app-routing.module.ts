import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from '../app/component/home/home.component';
import { TableComponent } from '../app/component/table/table.component';
import { DashboardComponent } from '../app/component/dashboard/dashboard.component';
const routes: Routes = [
  {path: 'com/base/getPageUrl.do', component: HomeComponent},
  {path: 'com/table', component: TableComponent},
  {path: 'com/dashboard', component: DashboardComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
