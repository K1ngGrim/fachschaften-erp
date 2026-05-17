import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetupFaPage } from './setup-fa-page';

describe('SetupFaPage', () => {
  let component: SetupFaPage;
  let fixture: ComponentFixture<SetupFaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupFaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupFaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
