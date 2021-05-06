import { Component, OnInit } from '@angular/core';
import { Post } from './post';
import { POSTS } from './mock-posts';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  posts = POSTS.slice(0,5);
  constructor() { }

  ngOnInit(): void {
  }

}
