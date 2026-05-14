import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AcceptInvitePage } from './accept-invite-page';

describe('AcceptInvitePage', () => {
  let component: AcceptInvitePage;
  let fixture: ComponentFixture<AcceptInvitePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcceptInvitePage],
    }).compileComponents();

    fixture = TestBed.createComponent(AcceptInvitePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
