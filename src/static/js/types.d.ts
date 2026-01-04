/**
 * Shared Type Definitions for PDF Viewer State
 * These interfaces enforce the contract between Backend and Frontend.
 */

export interface DocumentState {
    filename: string;
    currentPage: number;   // 1-indexed
    totalPages: number;
    zoomLevel: number;     // 1.0 = 100%
    lastUpdated?: string;  // ISO timestamp
}

export interface StateUpdatePayload {
    current_page: number;
    zoom_level: number;
}
