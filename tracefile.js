/**
 * TraceFile class - represents a file containing multiple traces
 */
class TraceFile {
    constructor(id, name, stateColumn) {
        this.id = id;
        this.name = name;
        this.stateColumn = stateColumn; // Name of the state column
        this.traces = new Map(); // Map of trace name -> Trace object
        this.states = []; // State values
        this.burnin = 0; // Burnin value (in state units, not sample count)
    }
    
    getId() {
        return this.id;
    }
    
    getName() {
        return this.name;
    }
    
    getStateColumn() {
        return this.stateColumn;
    }
    
    getStates() {
        return this.states;
    }
    
    setStates(states) {
        this.states = states;
    }
    
    addTrace(trace) {
        this.traces.set(trace.getName(), trace);
    }
    
    getTrace(name) {
        return this.traces.get(name);
    }
    
    getTraces() {
        return Array.from(this.traces.values());
    }
    
    getTraceNames() {
        return Array.from(this.traces.keys());
    }
    
    getTraceCount() {
        return this.traces.size;
    }
    
    hasTrace(name) {
        return this.traces.has(name);
    }
    
    getRowCount() {
        return this.states.length;
    }
    
    getMaxState() {
        if (this.states.length === 0) return 0;
        // Convert last state to number
        return parseFloat(this.states[this.states.length - 1]);
    }
    
    setBurnin(burnin) {
        this.burnin = burnin;
        // Propagate to all traces
        this.traces.forEach(trace => {
            trace.setBurnin(burnin);
        });
    }
    
    getBurnin() {
        return this.burnin;
    }
}
