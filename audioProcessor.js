class VADProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        const total = input[0].reduce((acc, val) => acc + Math.abs(val), 0);
        const average = total / input[0].length;

        this.port.postMessage({ volume: average });
        
        return true;
    }
}

registerProcessor('vad-processor', VADProcessor);
