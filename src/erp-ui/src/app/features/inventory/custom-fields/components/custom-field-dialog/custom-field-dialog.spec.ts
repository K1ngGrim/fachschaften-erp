import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomFieldDialog } from './custom-field-dialog';

describe('CustomFieldDialog', () => {
  let component: CustomFieldDialog;
  let fixture: ComponentFixture<CustomFieldDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomFieldDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomFieldDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
