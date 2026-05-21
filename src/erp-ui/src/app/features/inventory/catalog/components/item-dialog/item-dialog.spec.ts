import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemDialog } from './item-dialog';

describe('ItemDialog', () => {
  let component: ItemDialog;
  let fixture: ComponentFixture<ItemDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
