/**
 * Trace class - represents a single column of values from an MCMC chain
 */
class Trace {
    constructor(name, values, type) {
        this.name = name;
        this.values = values;
        this.type = type; // 'continuous', 'integer', or 'discrete'
        this._stats = null; // Cached statistics
        this.burninSamples = 0; // Burnin value in samples (number of samples to exclude from start)
    }
    
    getName() {
        return this.name;
    }
    
    getType() {
        return this.type;
    }
    
    getValues() {
        return this.values;
    }
    
    getLength() {
        return this.values.length;
    }
    
    getValue(index) {
        return this.values[index];
    }
    
    /**
     * Get computed statistics for this trace
     */
    getStatistics() {
        if (!this._stats) {
            this._computeStatistics();
        }
        return this._stats;
    }
    
    getMean() {
        return this.getStatistics().mean;
    }
    
    getMedian() {
        return this.getStatistics().median;
    }
    
    getMin() {
        return this.getStatistics().min;
    }
    
    getMax() {
        return this.getStatistics().max;
    }
    
    getStdDev() {
        return this.getStatistics().stdDev;
    }
    
    getVariance() {
        return this.getStatistics().variance;
    }
    
    getStdErr() {
        return this.getStatistics().stdErr;
    }
    
    getRange() {
        return this.getStatistics().range;
    }
    
    getHPD95Lower() {
        return this.getStatistics().hpd95Lower;
    }
    
    getHPD95Upper() {
        return this.getStatistics().hpd95Upper;
    }
    
    getACT() {
        return this.getStatistics().act;
    }
    
    getESS() {
        return this.getStatistics().ess;
    }
    
    getSampleCount() {
        return this.getStatistics().count;
    }
    
    // Set burnin in samples (number of samples to skip)
    setBurninSamples(burninSamples) {
        this.burninSamples = Math.max(0, Math.floor(burninSamples));
        this._stats = null; // Invalidate cached statistics
    }

    getBurninSamples() {
        return this.burninSamples;
    }
    
    /**
     * Compute statistics for this trace
     */
    _computeStatistics() {
        const numericValues = this.values
            .filter(v => v !== '' && v !== null && v !== undefined)
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v));
        
        if (numericValues.length === 0) {
            this._stats = {
                mean: null,
                median: null,
                min: null,
                max: null,
                stdDev: null,
                variance: null,
                stdErr: null,
                range: null,
                hpd95Lower: null,
                hpd95Upper: null,
                act: null,
                ess: null,
                count: 0
            };
            return;
        }
        
        // Apply burnin in samples if set
        let effectiveValues = numericValues;
        const burninSamples = Math.min(this.burninSamples, numericValues.length - 1);
        if (burninSamples > 0) {
            effectiveValues = numericValues.slice(burninSamples);
        }
        
        const n = effectiveValues.length;
        
        if (n === 0) {
            this._stats = {
                mean: null,
                median: null,
                min: null,
                max: null,
                stdDev: null,
                variance: null,
                stdErr: null,
                range: null,
                hpd95Lower: null,
                hpd95Upper: null,
                act: null,
                ess: null,
                count: 0
            };
            return;
        }
        
        // Mean
        const sum = effectiveValues.reduce((a, b) => a + b, 0);
        const mean = sum / n;
        
        // Variance and standard deviation
        const squaredDiffs = effectiveValues.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
        const stdDev = Math.sqrt(variance);
        
        // Standard error (without ACT correction for now)
        const stdErr = stdDev / Math.sqrt(n);
        
        // Min and max
        const min = Math.min(...effectiveValues);
        const max = Math.max(...effectiveValues);
        const range = max - min;
        
        // Median
        const sorted = [...effectiveValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        
        // 95% HPD (using percentile approximation)
        const lowerIndex = Math.max(0, Math.floor(n * 0.025));
        const upperIndex = Math.min(n - 1, Math.floor(n * 0.975));
        const hpd95Lower = sorted[lowerIndex];
        const hpd95Upper = sorted[upperIndex];
        
        // ACT (simplified calculation using lag-1 autocorrelation)
        const act = this._calculateACT(effectiveValues, mean);
        
        // ESS
        const ess = act > 0 ? n / act : n;
        
        this._stats = {
            mean,
            median,
            min,
            max,
            stdDev,
            variance,
            stdErr,
            range,
            hpd95Lower,
            hpd95Upper,
            act,
            ess,
            count: n
        };
    }
    
    _calculateACT(values, mean) {
        const n = values.length;
        if (n < 2) return 1;
        
        // Calculate lag-1 autocorrelation
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n - 1; i++) {
            numerator += (values[i] - mean) * (values[i + 1] - mean);
        }
        
        for (let i = 0; i < n; i++) {
            denominator += Math.pow(values[i] - mean, 2);
        }
        
        if (denominator === 0) return 1;
        
        const rho1 = numerator / denominator;
        
        // Simplified ACT calculation
        // Only calculate if rho1 is positive and less than 1
        if (rho1 >= 0 && rho1 < 1) {
            const act = 1 + 2 * rho1 / (1 - rho1);
            return Math.max(1, Math.min(act, n)); // Clamp between 1 and n
        }
        
        return 1;
    }
}
