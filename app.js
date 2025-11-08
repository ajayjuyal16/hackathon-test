const model = {
    isDetecting: false,
    currentFacingMode: 'environment',
    lastSpokenMessage: '',
    detectionInterval: null,
    videoStream: null,
    isMirrored: false,
    apiEndpoint: `${window.location.origin}/detect`,
    clickSound: null,
    notifySound: null
};

const view = {
    elements: {},
    bindEvents(controller) {
        const e = this.elements;
        e.getStartedBtn.addEventListener('click', () => { controller.onGetStarted(); });
        e.startStopBtn.addEventListener('click', () => { controller.onStartStopToggle(); });
        e.switchCameraBtn.addEventListener('click', () => { controller.onSwitchCamera(); });
    },
    initElements() {
        this.elements.welcomeScreen = document.getElementById('welcome-screen');
        this.elements.detectionScreen = document.getElementById('detection-screen');
        this.elements.getStartedBtn = document.getElementById('get-started-btn');
        this.elements.startStopBtn = document.getElementById('start-stop-btn');
        this.elements.startStopIcon = document.getElementById('start-stop-icon');
        this.elements.startStopText = document.getElementById('start-stop-text');
        this.elements.switchCameraBtn = document.getElementById('switch-camera-btn');
        this.elements.videoFeed = document.getElementById('video-feed');
        this.elements.statusBar = document.getElementById('status-bar');
        this.elements.statusText = document.getElementById('status-text');
        this.elements.loadingSpinner = document.getElementById('loading-spinner');
    },
    showDetectionScreen() {
        if (model.clickSound) model.clickSound.triggerAttackRelease("C2", "8n");
        this.elements.welcomeScreen.classList.remove('animate__zoomIn', 'animate__fadeIn');
        this.elements.welcomeScreen.classList.add('animate__animated', 'animate__zoomOut', 'animate__fast');
        this.elements.welcomeScreen.addEventListener('animationend', () => {
            this.elements.welcomeScreen.classList.add('d-none');
            this.elements.detectionScreen.classList.remove('d-none');
            this.elements.detectionScreen.classList.add('animate__animated', 'animate__zoomIn', 'animate__fast');
            setTimeout(() => this.elements.videoFeed.parentElement.classList.add('visible'), 100);
            setTimeout(() => this.elements.startStopBtn.parentElement.classList.add('visible'), 200);
            setTimeout(() => this.elements.statusBar.classList.add('visible'), 300);
        }, { once: true });
    },
    updateStatus(message, isLive = false, isError = false) {
        this.elements.statusText.textContent = message;
        this.elements.statusBar.classList.toggle('live', isLive);
        this.elements.statusBar.classList.toggle('alert-secondary', !isError && !isLive);
        this.elements.statusBar.classList.toggle('alert-success', isLive);
        this.elements.statusBar.classList.toggle('alert-danger', isError);
    },
    setDetectingState(isDetecting) {
        if (isDetecting) {
            this.elements.startStopText.textContent = 'Stop Detection';
            this.elements.startStopIcon.classList.replace('bi-play-circle-fill', 'bi-stop-circle-fill');
            this.elements.startStopBtn.classList.replace('btn-primary', 'btn-danger');
            this.updateStatus('Detection active...', true);
        } else {
            this.elements.startStopText.textContent = 'Start Detection';
            this.elements.startStopIcon.classList.replace('bi-stop-circle-fill', 'bi-play-circle-fill');
            this.elements.startStopBtn.classList.replace('btn-danger', 'btn-primary');
            this.updateStatus('Detection stopped.');
        }
    },
    setMirrored(isMirrored) {
        this.elements.videoFeed.classList.toggle('unmirrored', !isMirrored);
    },
    showLoading(isLoading) {
        this.elements.loadingSpinner.classList.toggle('d-none', !isLoading);
    },
    playClickAnimation(element) {
        element.classList.add('animate__animated', 'animate__headShake', 'animate__fast');
        element.addEventListener('animationend', () => {
            element.classList.remove('animate__animated', 'animate__headShake', 'animate__fast');
        }, { once: true });
    },
    playNotifyAnimation() {
        this.elements.statusBar.classList.add('animate__animated', 'animate__tada', 'animate__fast');
        this.elements.statusBar.addEventListener('animationend', () => {
            this.elements.statusBar.classList.remove('animate__animated', 'animate__tada', 'animate__fast');
        }, { once: true });
    }
};

const controller = {
    init() {
        view.initElements();
        view.bindEvents(this);
        if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            model.apiEndpoint = 'http://127.0.0.1:5000/detect';
        }
    },
    async onGetStarted() {
        view.playClickAnimation(view.elements.getStartedBtn);
        if (typeof Tone !== 'undefined') {
            try { await Tone.start(); } catch(e) {}
            if (!model.clickSound) model.clickSound = new Tone.MembraneSynth().toDestination();
            if (!model.notifySound) {
                model.notifySound = new Tone.MetalSynth({
                    frequency: 200,
                    envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                    harmonicity: 3.1,
                    modulationIndex: 32,
                    resonance: 4000,
                    octaves: 1.5
                }).toDestination();
            }
            model.clickSound.triggerAttackRelease("C2", "8n");
        }
        view.showDetectionScreen();
        await this.startCamera(model.currentFacingMode);
    },
    onStartStopToggle() {
        model.isDetecting = !model.isDetecting;
        view.playClickAnimation(view.elements.startStopBtn);
        if (model.clickSound) model.clickSound.triggerAttackRelease("C2", "8n");
        view.setDetectingState(model.isDetecting);
        if (model.isDetecting) {
            model.detectionInterval = setInterval(this.captureAndSendFrame, 1000);
        } else {
            clearInterval(model.detectionInterval);
            view.showLoading(false);
        }
    },
    onSwitchCamera() {
        view.playClickAnimation(view.elements.switchCameraBtn);
        if (model.clickSound) model.clickSound.triggerAttackRelease("C2", "8n");
        model.currentFacingMode = (model.currentFacingMode === 'user') ? 'environment' : 'user';
        this.stopCamera();
        this.startCamera(model.currentFacingMode);
    },
    stopCamera() {
        if (model.videoStream) {
            model.videoStream.getTracks().forEach(track => track.stop());
            model.videoStream = null;
        }
        if (model.isDetecting) this.onStartStopToggle();
    },
    async startCamera(facingMode) {
        if (model.videoStream) model.videoStream.getTracks().forEach(track => track.stop());
        view.updateStatus('Starting camera...');
        const constraints = { video: { facingMode: { exact: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } };
        try {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                model.videoStream = stream;
            } catch {
                const fallback = { video: { facingMode: facingMode } };
                const stream = await navigator.mediaDevices.getUserMedia(fallback);
                model.videoStream = stream;
            }
            view.elements.videoFeed.srcObject = model.videoStream;
            const settings = model.videoStream.getVideoTracks()[0].getSettings();
            model.isMirrored = (settings.facingMode === 'user');
            view.setMirrored(model.isMirrored);
            view.updateStatus('Camera started. Ready to detect.', false);
        } catch (err) {
            console.error("Error starting camera:", err);
            view.updateStatus('Could not access camera.', false, true);
        }
    },
    speak(text) {
        if (text && text !== model.lastSpokenMessage) {
            model.lastSpokenMessage = text;
            if (model.notifySound) model.notifySound.triggerAttackRelease("C4", "0.2");
            view.playNotifyAnimation();
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    },
    async captureAndSendFrame() {
        if (!model.videoStream) return;
        view.showLoading(true);
        const video = view.elements.videoFeed;
        const canvas = document.createElement('canvas');
        const max_width = 640;
        const scale = max_width / (video.videoWidth || 640);
        canvas.width = max_width;
        canvas.height = (video.videoHeight || 480) * scale;
        const context = canvas.getContext('2d');
        if (model.isMirrored) {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataURL.split(',')[1];
        try {
            const response = await fetch(model.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Data })
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            view.updateStatus(result.guidance || 'No objects detected.', true);
            controller.speak(result.actionable_guidance || result.guidance || '');
        } catch (error) {
            console.error('Error sending frame:', error);
            view.updateStatus('Connection error.', false, true);
            if (model.isDetecting) controller.onStartStopToggle();
        } finally {
            view.showLoading(false);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    controller.init();
});
