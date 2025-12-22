/**
 * Tracer class - manages multiple TraceFile objects
 */
class Tracer {
    constructor() {
        this.traceFiles = new Map(); // Map of file id -> TraceFile object
    }
    
    addTraceFile(traceFile) {
        this.traceFiles.set(traceFile.getId(), traceFile);
    }
    
    getTraceFile(id) {
        return this.traceFiles.get(id);
    }
    
    getTraceFiles() {
        return Array.from(this.traceFiles.values());
    }
    
    getTraceFileIds() {
        return Array.from(this.traceFiles.keys());
    }
    
    getTraceFileCount() {
        return this.traceFiles.size;
    }
    
    hasTraceFile(id) {
        return this.traceFiles.has(id);
    }
    
    removeTraceFile(id) {
        return this.traceFiles.delete(id);
    }
    
    clear() {
        this.traceFiles.clear();
    }
}
