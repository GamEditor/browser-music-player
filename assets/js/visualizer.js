var AUDIO = AUDIO || {};
window.AudioContext = window.AudioContext || window.webkitAudioContext;
var permanentCtx = new window.AudioContext();

AUDIO.VISUALIZER = (function () {
    'use strict';

    var INTERVAL = null;
    var progressINTERVAL = null;
    var visualizer = null;
    var FFT_SIZE = 512;
    var TYPE = {
        'lounge': 'renderLounge'
    };

    /**
     * @description
     * Visualizer constructor.
     *
     * @param {Object} cfg
     */

    function Visualizer(cfg) {
        var _this = this;

        this.isPlaying = false;
        this.autoplay = cfg.autoplay || false;
        this.audio = document.getElementById(cfg.audio) || {};
        this.canvas = document.getElementById(cfg.canvas) || {};
        this.canvasCtx = this.canvas.getContext('2d') || null;
        this.author = this.audio.getAttribute('data-author') || '';
        this.title = this.audio.getAttribute('data-title') || '';
        this.ctx = null;
        this.analyser = null;
        this.sourceNode = null;
        this.frequencyData = [];
        this.audioSrc = null;
        this.duration = 0;
        this.minutes = '00';
        this.seconds = '00';
        this.style = cfg.style || 'lounge';
        this.barWidth = cfg.barWidth || 2;
        this.barHeight = cfg.barHeight || 2;
        this.barSpacing = cfg.barSpacing || 5;
        this.barColor = cfg.barColor || '#ffffff';
        this.shadowBlur = cfg.shadowBlur || 10;
        this.shadowColor = cfg.shadowColor || '#ffffff';
        this.font = cfg.font || ['12px', 'Helvetica'];
        this.gradient = null;

        // volume controller
        this.gainNode = null;
        this.volumeController = document.getElementById(cfg.volumeController);

        // player controllers
        this.externalPlayBtn = document.getElementById(cfg.externalPlayBtn);
        this.progressController = document.getElementById(cfg.progressController);

        this.progressController.value = 0;

        // player events
        this.externalPlayBtn.onclick = function (event) {
            if (!_this.isPlaying) {
                _this.externalPlayBtn.innerHTML = "<i class='fa fa-pause'></i>";
                return (_this.ctx.state === 'suspended') ? _this.playSound() : _this.loadSound();
            } else {
                _this.externalPlayBtn.innerHTML = "<i class='fas fa-play'></i>";
                return _this.pauseSound();
            }
        }

        this.volumeController.onchange = function (event) {
            if (permanentCtx) {
                _this.gainNode.gain.value = (parseFloat(this.value) / 100) - 1; // -1 meaning mute
            }
        }

        this.progressController.oninput = function (event) {
            if (permanentCtx) {
                // _this.ctx.currentTime = parseFloat(this.value);
                // _this.gainNode.gain.setValueAtTime(_this.gainNode.gain.value, parseFloat(this.value));
                // _this.gainNode.gain.setValueAtTime(_this.gainNode.gain.value, _this.ctx.currentTime + 1);
            }
        }
    }

    /**
     * @description
     * Set current audio context.
     *
     * @return {Object}
     */
    Visualizer.prototype.setContext = function () {
        try {
            clearInterval(INTERVAL);
            clearInterval(progressINTERVAL);

            this.ctx = permanentCtx;
            return this;
        } catch (e) {
            console.info('Web Audio API is not supported.', e);
        }
    };

    /**
     * @description
     * Set buffer analyser.
     *
     * @return {Object}
     */
    Visualizer.prototype.setAnalyser = function () {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.smoothingTimeConstant = 0.6;
        this.analyser.fftSize = FFT_SIZE;
        return this;
    };

    /**
     * @description
     * Set frequency data.
     *
     * @return {Object}
     */
    Visualizer.prototype.setFrequencyData = function () {
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        return this;
    };

    /**
     * @description
     * Set source buffer and connect processor and analyser.
     *
     * @return {Object}
     */
    Visualizer.prototype.setBufferSourceNode = function () {
        var _this = this;
        this.sourceNode = this.ctx.createBufferSource();

        // volume cntroller value
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = (parseFloat(this.volumeController.value) / 100) - 1;
        this.gainNode.connect(this.ctx.destination);

        this.sourceNode.connect(this.gainNode);
        // volume cntroller value

        this.sourceNode.connect(this.analyser);
        this.sourceNode.connect(this.ctx.destination);

        this.sourceNode.onended = function () {
            clearInterval(INTERVAL);
            clearInterval(progressINTERVAL);

            this.sourceNode.disconnect();
            this.resetTimer();
            this.isPlaying = false;
            this.sourceNode = this.ctx.createBufferSource();

            if (repeat) {
                replayAudio();
            } else {
                playNextFromList();
            }
        }.bind(this);

        return this;
    };

    /**
     * @description
     * Set current media source url.
     *
     * @return {Object}
     */
    Visualizer.prototype.setMediaSource = function () {
        this.audioSrc = this.audio.getAttribute('src');
        return this;
    };

    /**
     * @description
     * Set canvas gradient color.
     *
     * @return {Object}
     */
    Visualizer.prototype.setCanvasStyles = function () {
        this.gradient = this.canvasCtx.createLinearGradient(0, 0, 0, 300);
        this.gradient.addColorStop(1, this.barColor);
        this.canvasCtx.fillStyle = this.gradient;
        this.canvasCtx.shadowBlur = this.shadowBlur;
        this.canvasCtx.shadowColor = this.shadowColor;
        this.canvasCtx.font = this.font.join(' ');
        this.canvasCtx.textAlign = 'center';
        return this;
    };

    /**
     * @description
     * Bind click events.
     *
     * @return {Object}
     */
    Visualizer.prototype.bindEvents = function () {
        var _this = this;

        // document.addEventListener('click', function (e) {
        //     if (e.target === _this.canvas) {
        //         e.stopPropagation();
        //         if (!_this.isPlaying) {
        //             _this.externalPlayBtn.innerHTML = "<i class='fa fa-pause'></i>";
        //             return (_this.ctx.state === 'suspended') ? _this.playSound() : _this.loadSound();
        //         } else {
        //             _this.externalPlayBtn.innerHTML = "<i class='fas fa-play'></i>";
        //             return _this.pauseSound();
        //         }
        //     }
        // });

        if (_this.autoplay) {
            _this.loadSound();
        }

        return this;
    };

    /**
     * @description
     * Load sound file.
     */
    Visualizer.prototype.loadSound = function () {
        this.canvasCtx.fillText('Loading...', this.canvas.width / 2 + 10, this.canvas.height / 2);
        this.ctx.decodeAudioData(arrayBuffer, this.playSound.bind(this), this.onError.bind(this));
    };

    /**
     * @description
     * Play sound from the given buffer.
     *
     * @param  {Object} buffer
     */
    Visualizer.prototype.playSound = function (buffer) {
        this.isPlaying = true;

        if (this.ctx.state === 'suspended') {
            return this.ctx.resume();
        }

        this.sourceNode.buffer = buffer;
        this.sourceNode.start(0);
        this.resetTimer();
        this.startTimer();
        this.renderFrame();
    };

    /**
     * @description
     * Pause current sound.
     */
    Visualizer.prototype.pauseSound = function () {
        this.isPlaying = false;
        this.ctx.suspend();
    };

    /**
     * @description
     * Start playing timer.
     */
    Visualizer.prototype.startTimer = function () {
        var _this = this;
        INTERVAL = setInterval(function () {
            if (_this.isPlaying) {
                var now = new Date(_this.duration);
                var min = now.getHours();
                var sec = now.getMinutes();
                _this.minutes = (min < 10) ? '0' + min : min;
                _this.seconds = (sec < 10) ? '0' + sec : sec;
                _this.duration = now.setMinutes(sec + 1);
            }
        }, 1000);

        this.progressController.style.width = "0%";
        progressINTERVAL = setInterval(function () {
            if (_this.isPlaying) {
                var max = parseFloat(_this.progressController.getAttribute("data-max"));
                _this.progressController.style.width = ((_this.ctx.currentTime / max) * 100) + "%";
            }
        }, 150);
    };

    /**
     * @description
     * Reset time counter.
     */
    Visualizer.prototype.resetTimer = function () {
        var time = new Date(0, 0);
        this.duration = time.getTime();
    };

    /**
     * @description
     * On audio data stream error fn.
     *
     * @param  {Object} e
     */
    Visualizer.prototype.onError = function (e) {
        this.progressController.style.width = "0%";
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);  // testing
        showToastMessage('Error decoding audio file. -- ' + e, 10000);
    };

    /**
     * @description
     * Render frame on canvas.
     */
    Visualizer.prototype.renderFrame = function () {
        requestAnimationFrame(this.renderFrame.bind(this));
        this.analyser.getByteFrequencyData(this.frequencyData);

        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.renderTime();
        this.renderText();
        this.renderByStyleType();
    };

    /**
     * @description
     * Render audio author and title.
     */
    Visualizer.prototype.renderText = function () {
        // cause visualizer never gets a new instance more than start time
        this.author = this.audio.getAttribute('data-author') || '';
        this.title = this.audio.getAttribute('data-title') || '';

        var cx = this.canvas.width / 2;
        var cy = this.canvas.height / 2;
        var correction = 10;

        this.canvasCtx.textBaseline = 'top';
        if (this.author != "") {
            this.canvasCtx.fillText('by ' + this.author, cx + correction, cy);
        } else {
            this.canvasCtx.fillText('', cx + correction, cy);
        }
        this.canvasCtx.font = parseInt(this.font[0], 10) + 8 + 'px ' + this.font[1];
        this.canvasCtx.textBaseline = 'bottom';
        if (this.title != "") {
            this.canvasCtx.fillText(this.title, cx + correction, cy);
        } else {
            this.canvasCtx.fillText('', cx + correction, cy);
        }
        this.canvasCtx.font = this.font.join(' ');
    };

    /**
     * @description
     * Render audio time.
     */
    Visualizer.prototype.renderTime = function () {
        var time = this.minutes + ':' + this.seconds;
        this.canvasCtx.fillText(time, this.canvas.width / 2 + 10, this.canvas.height / 2 + 40);
    };

    /**
     * @description
     * Render frame by style type.
     *
     * @return {Function}
     */
    Visualizer.prototype.renderByStyleType = function () {
        return this[TYPE[this.style]]();
    };

    /**
     * @description
     * Render lounge style type.
     */
    Visualizer.prototype.renderLounge = function () {
        var cx = this.canvas.width / 2;
        var cy = this.canvas.height / 2;
        var radius = 140;
        var maxBarNum = Math.floor((radius * 2 * Math.PI) / (this.barWidth + this.barSpacing));
        var slicedPercent = Math.floor((maxBarNum * 25) / 100);
        var barNum = maxBarNum - slicedPercent;
        var freqJump = Math.floor(this.frequencyData.length / maxBarNum);

        for (var i = 0; i < barNum; i++) {
            var amplitude = this.frequencyData[i * freqJump];
            var alfa = (i * 2 * Math.PI) / maxBarNum;
            var beta = (3 * 45 - this.barWidth) * Math.PI / 180;
            var x = 0;
            var y = radius - (amplitude / 12 - this.barHeight);
            var w = this.barWidth;
            var h = amplitude / 6 + this.barHeight;

            this.canvasCtx.save();
            this.canvasCtx.translate(cx + this.barSpacing, cy + this.barSpacing);
            this.canvasCtx.rotate(alfa - beta);
            this.canvasCtx.fillRect(x, y, w, h);
            this.canvasCtx.restore();
        }
    };

    /**
     * @description
     * Create visualizer object instance.
     *
     * @param  {Object} cfg
     * {
     *     autoplay: <Bool>,
     *     audio: <String>,
     *     canvas: <String>,
     *     volumeController: <String>,
     *     style: <String>,
     *     barWidth: <Integer>,
     *     barHeight: <Integer>,
     *     barSpacing: <Integer>,
     *     barColor: <String>,
     *     shadowBlur: <Integer>,
     *     shadowColor: <String>,
     *     font: <Array>
     * }
     * @return {Function}
     * @private
     */
    function _createVisualizer(cfg) {
        if (permanentCtx) {
            permanentCtx.close();
            permanentCtx = new window.AudioContext();
        }

        if (!visualizer) {
            visualizer = new Visualizer(cfg);
        }

        return function () {
            visualizer
                .setContext()
                .setAnalyser()
                .setFrequencyData()
                .setBufferSourceNode()
                .setMediaSource()
                .setCanvasStyles()
                .bindEvents()

            return visualizer;
        };
    }

    /**
     * @description
     * Get visualizer instance.
     *
     * @param  {Object} cfg
     * @return {Object}
     * @public
     */
    function getInstance(cfg) {
        return _createVisualizer(cfg)();
    }

    /**
     * @description
     * Visualizer module API.
     *
     * @public
     */
    return {
        getInstance: getInstance,
    };
})();