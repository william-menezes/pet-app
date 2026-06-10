import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RescuePage } from './rescue-page';

describe('RescuePage', () => {
  let component: RescuePage;
  let fixture: ComponentFixture<RescuePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RescuePage],
    }).compileComponents();

    fixture = TestBed.createComponent(RescuePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
