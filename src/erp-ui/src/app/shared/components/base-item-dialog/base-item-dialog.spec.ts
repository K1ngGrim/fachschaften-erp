import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaseItemDialog } from './base-item-dialog';

describe('BaseItemDialog', () => {
  let component: BaseItemDialog;
  let fixture: ComponentFixture<BaseItemDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BaseItemDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(BaseItemDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
