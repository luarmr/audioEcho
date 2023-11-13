document.addEventListener("DOMContentLoaded", async () => {
    const statusMessage = document.getElementById("status-message");
    const thresholdSlider = document.getElementById("threshold-slider");
    const thresholdValueDisplay = document.getElementById("threshold-value");
    const silenceSlider = document.getElementById("silence-slider");
    const silenceValueDisplay = document.getElementById("silence-value");
    const noiseLevelBar = document.getElementById("noise-level-bar");
    const pauseButton = document.getElementById("pause-button");

    let silenceThreshold = 1000;
    let vadThreshold = 0.1;
    let isRecording = false;
    let isPaused = false;
    let silenceTimer = null;
    let audioChunks = [];
    let vadProcessor;
    let mediaRecorder;
    let lastBarWidth = 0;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule('audioProcessor.js?v=1');
        const microphone = audioContext.createMediaStreamSource(stream);
        vadProcessor = new AudioWorkletNode(audioContext, 'vad-processor');
        vadProcessor.port.postMessage({ threshold: vadThreshold });
        microphone.connect(vadProcessor).connect(audioContext.destination);

        mediaRecorder = new MediaRecorder(stream);
        setupEventHandlers(vadProcessor, mediaRecorder);
    } catch (error) {
        statusMessage.textContent = "Microphone access denied";
        console.error("Microphone access error:", error);
    }



    thresholdSlider.addEventListener('input', function() {
        vadThreshold = parseFloat(this.value);
        let thresholdPercentage = Math.round(vadThreshold * 100);
        thresholdValueDisplay.textContent = `${thresholdPercentage}%`;
        this.setAttribute("aria-valuetext", `${thresholdPercentage}%`);
    });
    
    silenceSlider.addEventListener('input', function() {
        silenceThreshold = parseInt(this.value, 10);
        let silenceInSeconds = (silenceThreshold / 1000).toFixed(2);
        silenceValueDisplay.textContent = `${silenceInSeconds} s`;
        this.setAttribute("aria-valuetext", `${silenceInSeconds} s`);
    });


    pauseButton.addEventListener('click', () => {
        if (!isPaused) {
            pauseRecording();
            pauseButton.textContent = "Resume";
        } else {
            resumeRecording();
            pauseButton.textContent = "Pause";
        }
        isPaused = !isPaused;
    });
    
    function setupEventHandlers(vadProcessor, mediaRecorder) {
        vadProcessor.port.onmessage = ({ data }) => {
            const normalizedNoiseLevel = Math.min(Math.max(data.volume, 0), 1) * 100;
            const barWidth = Math.round(normalizedNoiseLevel); 
        
            if (barWidth !== lastBarWidth) { 
                if (barWidth < lastBarWidth) {
                    noiseLevelBar.classList.add('smooth-transition');
                } else {
                    noiseLevelBar.classList.remove('smooth-transition');
                }
        
                noiseLevelBar.style.width = `${barWidth}%`;
                noiseLevelBar.setAttribute("aria-valuenow", barWidth);  

                lastBarWidth = barWidth; 
            }

            if (!isPaused) {
                handleVADProcessorMessage(data, mediaRecorder);
            }
        };
        

        mediaRecorder.ondataavailable = ({ data }) => {
            audioChunks.push(data);
        };

        mediaRecorder.onstop = () => {
            if (!isPaused) {
                processRecording();
            } else {
                audioChunks = [];
            }
        };
    }

    function pauseRecording() {
        if (isRecording) {
            mediaRecorder.stop();
            isRecording = false;
        }
        clearSilenceTimer();
        updateStatus("Paused");
    }
    


    function resumeRecording() {
        updateStatus("Ready to record");
    }

    function startRecordingIfNeeded(mediaRecorder) {
        if (!isRecording && mediaRecorder.state === "inactive") {
            mediaRecorder.start();
            isRecording = true;
            updateStatus("Recording...");
        }
    }

    function handleVADProcessorMessage(data, mediaRecorder) {
        if (data.volume > vadThreshold) {
            startRecordingIfNeeded(mediaRecorder);
            resetSilenceTimer(mediaRecorder);
        } else {
            startSilenceTimerIfNeeded(mediaRecorder);
        }
    }

    function resetSilenceTimer(mediaRecorder) {
        clearSilenceTimer();
        silenceTimer = setTimeout(() => {
            if (isRecording) {
                mediaRecorder.stop();
                isRecording = false;
            }
        }, silenceThreshold);
    }

    function startSilenceTimerIfNeeded(mediaRecorder) {
        if (!silenceTimer && isRecording) {
            silenceTimer = setTimeout(() => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                    isRecording = false;
                }
            }, silenceThreshold);
        }
    }

    function clearSilenceTimer() {
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
    }

    function processRecording() {
        if (audioChunks.length > 0) {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            playAudioBlob(audioBlob);
            audioChunks = [];
        }
        updateStatus("Ready to record");
    }

    function playAudioBlob(blob) {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.onended = () => updateStatus("Ready to record");
        audio.play();
        updateStatus("Playing back");
    }

    function updateStatus(message) {
        statusMessage.textContent = message;
    }
});
