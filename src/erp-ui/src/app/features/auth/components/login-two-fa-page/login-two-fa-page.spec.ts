import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginTwoFaPage } from './login-two-fa-page';

describe('LoginTwoFaPage', () => {
  let component: LoginTwoFaPage;
  let fixture: ComponentFixture<LoginTwoFaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginTwoFaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginTwoFaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
