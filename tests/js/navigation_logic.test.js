
import { describe, it, expect } from 'vitest';
import { calculateFitZoom, parseZoomInput } from '../../src/static/js/modules/navigation.js';

describe('Navigation Logic', () => {
    describe('calculateFitZoom', () => {
        it('should calculate fit width correctly', () => {
            // Container 1048px wide (1000 after 48px padding), Content 500px wide
            // Zoom should be 2.0
            const zoom = calculateFitZoom('fitWidth', 1048, 800, 500, 800);
            expect(zoom).toBe(2.0);
        });

        it('should calculate fit page correctly (constrained by width)', () => {
            // Container 1048x1000, Content 500x800
            // FitWidth = 2.0. FitHeight = (1000-48)/800 = 1.19
            const zoom = calculateFitZoom('fitPage', 1048, 1000, 500, 800);
            expect(zoom).toBeCloseTo(1.19, 2);
        });

        it('should return 1.0 for invalid content dimensions', () => {
            expect(calculateFitZoom('fitWidth', 1000, 1000, 0, 0)).toBe(1.0);
        });
    });

    describe('parseZoomInput', () => {
        it('should parse simple percentage', () => {
            expect(parseZoomInput('150%')).toBe(1.5);
            expect(parseZoomInput('50')).toBe(0.5);
        });

        it('should return null for invalid input', () => {
            expect(parseZoomInput('abc')).toBe(null);
            expect(parseZoomInput('')).toBe(null);
        });
    });
});
