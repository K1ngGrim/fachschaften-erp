import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomFieldsPage } from './custom-fields-page';

describe('CustomFieldsPage', () => {
  let component: CustomFieldsPage;
  let fixture: ComponentFixture<CustomFieldsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomFieldsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomFieldsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
