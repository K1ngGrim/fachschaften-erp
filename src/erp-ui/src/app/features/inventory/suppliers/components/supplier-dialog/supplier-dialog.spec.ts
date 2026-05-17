import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierDialog } from './supplier-dialog';

describe('SupplierDialog', () => {
  let component: SupplierDialog;
  let fixture: ComponentFixture<SupplierDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
