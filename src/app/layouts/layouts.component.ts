import { Component, OnInit } from '@angular/core';
import {Layout} from '../layout'

//Component decorator
@Component({
  selector: 'app-layouts',
  templateUrl: './layouts.component.html',
  styleUrls: ['./layouts.component.css']
})

//Component Class : 상태관리 , data 관리
export class LayoutsComponent implements OnInit {
  layout:Layout ={
    id:1,
    name:"hellow world"

  }

  constructor() { }

  ngOnInit(): void {
  }

}
