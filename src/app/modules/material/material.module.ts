import { NgModule } from '@angular/core';

import { CommonModule } from '@angular/common';

import { MatSidenavModule } from '@angular/material/sidenav';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatListModule} from '@angular/material/list';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatTableModule} from '@angular/material/table';
import {MatSliderModule} from '@angular/material/slider';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatExpansionModule} from '@angular/material/expansion';

 

@NgModule({

  imports: [

    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatSliderModule,
    MatSidenavModule,
    MatIconModule,
    MatMenuModule,
    MatExpansionModule

  ],

  exports: [

    MatSidenavModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatSliderModule,
    MatSidenavModule,
    MatIconModule,
    MatMenuModule,
    MatExpansionModule


  ],

  declarations: []

})

export class MaterialModule { }


