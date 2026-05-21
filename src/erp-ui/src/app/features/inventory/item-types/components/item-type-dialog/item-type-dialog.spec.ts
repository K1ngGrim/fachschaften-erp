import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemTypeDialog } from './item-type-dialog';

describe('ItemTypeDialog', () => {
  let component: ItemTypeDialog;
  let fixture: ComponentFixture<ItemTypeDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemTypeDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemTypeDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
