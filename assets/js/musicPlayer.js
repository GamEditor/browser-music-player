var jsmediatags = window.jsmediatags;
var imageBytes = null;

var files;
var arrayBuffer;

var repeat = false;

function getFileSize(bytes) {
    if (bytes <= 1024) { return (`${bytes} Byte`); }
    else if (bytes > 1024 && bytes <= 1048576) { return ((bytes / 1024).toPrecision(3) + ' KB'); }
    else if (bytes > 1048576 && bytes <= 1073741824) { return ((bytes / 1048576).toPrecision(3) + ' MB'); }
    else if (bytes > 1073741824 && bytes <= 1099511627776) { return ((bytes / 1073741824).toPrecision(3) + ' GB'); }
};

function getTimeFromSeconds(seconds) {
    seconds = parseInt(seconds);
    var min = seconds / 60;
    var sec = seconds % 60;

    min = min < 10 ? "0" + parseInt(min) : parseInt(min);
    sec = sec < 10 ? "0" + parseInt(sec) : parseInt(sec);
    return min + ":" + sec;
}

function setAudioDurationProgress(audioIndex) {
    return new Promise(function (resolve, reject) {
        audioIndex = parseInt(audioIndex);

        // Create a non-dom allocated Audio element
        var audio = document.createElement('audio');

        var file = files[audioIndex];
        var reader = new FileReader();

        if (file) {
            var reader = new FileReader();

            reader.onload = function (e) {
                audio.src = e.target.result;
                audio.addEventListener('loadedmetadata', function () {
                    $("#audioDuraion").html(getTimeFromSeconds(audio.duration));
                    $("#audioProgress").attr("data-max", parseFloat(audio.duration));
                    resolve();
                }, false);
            };

            reader.readAsDataURL(file);
        }
    });
}

function playAudio(audioIndex) {
    audioIndex = parseInt(audioIndex);

    $("#src").attr("src", $("#playList [data-index='" + audioIndex + "']").attr("data-file"));

    var reader = new FileReader();
    reader.onload = function (e) {
        arrayBuffer = this.result;

        // MP3Tag Usage
        var mp3tag = new MP3Tag(arrayBuffer);
        mp3tag.read();
        setCoverImage(mp3tag.tags);

        $("#audio").attr("data-title", mp3tag.tags.title);
        $("#audio").attr("data-author", mp3tag.tags.artist);

        setAudioDurationProgress(audioIndex).then(function () {
            AUDIO.VISUALIZER.getInstance({
                autoplay: true,
                // loop: true,  // loop handled globally
                audio: 'audio',
                canvas: 'audioCanvas',
                volumeController: 'playerVolumeSilder',
                progressController: 'audioProgress',
                externalPlayBtn: 'playAndPause',
                style: 'lounge',
                barWidth: 2,
                barHeight: 2,
                barSpacing: 7,
                barColor: '#cafdff',
                shadowBlur: 20,
                shadowColor: '#ffffff',
                font: ['12px', 'Helvetica']
            });
        });

        $("#playerControls [data-control='playAndPause']").html("<i class='fa fa-pause'></i>");
    }
    reader.readAsArrayBuffer(files[audioIndex]);
}

function replayAudio() {
    $("#playList [data-file].active").trigger("click");
}

function playNextFromList() {
    $("#playerControls [data-control='next']").trigger("click");
    focusOnCurrentSong();
}

function setupPlayListEvents() {
    $("#playList [data-file]").on("click", function (event) {
        $("#playList [data-file]").removeClass("active");

        $(this).addClass("active");
        playAudio($(this).attr("data-index"));
    });
}

function imageURL(bytes, format) {
    var encoded = ''
    bytes.forEach(function (byte) {
        encoded += String.fromCharCode(byte)
    });

    return "data:" + format + ";base64," + btoa(encoded);
}

function getRandomNumber(max) {
    return parseInt(Math.random() * max);
}

function setRandomCoverImage() {
    var randomImagePath = "assets/img/" + getRandomNumber(7) + ".gif";
    $('#cover-preview').attr("src", randomImagePath);
}

function setCoverImage(audioTags) {
    if (audioTags.v2) {
        if (audioTags.v2.APIC && audioTags.v2.APIC.length > 0) {
            var image = audioTags.v2.APIC[0];
            $('#cover-preview').attr("src", imageURL(image.data, image.format));
        }
    } else {
        setRandomCoverImage();
    }
}

function focusOnCurrentSong() {
    var activeFileHeight = $("[data-index].active").css("height");
    activeFileHeight = parseInt(activeFileHeight.substring(0, activeFileHeight.length - 2));    // number - "px"

    var currentIndex = parseInt($("[data-index].active").attr("data-index"));

    $("#filesContainer").animate({
        scrollTop: activeFileHeight * currentIndex
    }, 500);
}

function setupFileInputEvents() {
    $("#openFilesbtn").on("click", function (event) {
        $("#musicSelector").trigger("click");
    });

    $("#musicSelector").on("change", function (event) {
        if (permanentCtx) {
            permanentCtx.close();
            permanentCtx = new window.AudioContext();
        }

        files = this.files;

        if (files.length == 0) {
            $('#cover-preview').attr("src", "");
            $("#audioProgress").css("width", "0%");
            $("#audioDuraion").html("00:00");
            var audioCanvas = document.getElementById("audioCanvas").getContext('2d');
            audioCanvas.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
        }

        var musicElems = "";
        for (var i = 0; i < files.length; i++) {
            if (files[i].type == "audio/mpeg") {
                musicElems +=
                    "<tr data-index='" + i + "' data-file='" + URL.createObjectURL(files[i]) + "'>" +
                    "<td class='rowNumber'>" + (i + 1) + "</td>" +
                    "<td class='fileName'>" + files[i].name + "</td>" +
                    "<td class='fileSize'>" + getFileSize(files[i].size) + "</td>" +
                    "</tr>";
            }
        }
        $("#playList").html(musicElems);

        setupPlayListEvents();
        $("#playList [data-file][data-index='0']").trigger("click");
    });
}

function setupPlayerControls() {
    // previous song
    $("#playerControls [data-control='previous']").on("click", function (event) {
        if ($("#playList [data-file].active").length == 1) {
            var lastIndex = $("#playList [data-file]").length - 1;

            var index = parseInt($("#playList [data-file].active").attr("data-index"));
            if (index > 0) {
                index--;
            } else {
                index = lastIndex;
            }

            $("#playerControls [data-control='playAndPause']").html("<i class='fa fa-pause'></i>");
            $("#playList [data-file][data-index='" + index + "']").trigger("click");
        }
    });

    // next song
    $("#playerControls [data-control='next']").on("click", function (event) {
        if ($("#playList [data-file].active").length == 1) {
            var lastIndex = $("#playList [data-file]").length - 1;

            var index = parseInt($("#playList [data-file].active").attr("data-index"));
            if (index < lastIndex) {
                index++;
            } else {
                index = 0;
            }

            $("#playerControls [data-control='playAndPause']").html("<i class='fa fa-pause'></i>");
            $("#playList [data-file][data-index='" + index + "']").trigger("click");
        }
    });

    // stop song
    $("#playerControls [data-control='stop']").on("click", function (event) {
        if (permanentCtx) {
            permanentCtx.close();
            permanentCtx = new window.AudioContext();
        }

        $("#playerControls [data-control='playAndPause']").html("<i class='fas fa-play'></i>");
        $("#playList [data-file]").removeClass("active");
    });

    // replay current song
    $("#playerControls [data-control='repeat']").on("click", function (event) {
        repeat = !repeat;

        if (repeat) {
            $(this).css("color", "white");
        } else {
            $(this).css("color", "black");
        }
    });
}

function setupVolumeControllerEvents() {
    $("#volumeProgressContainer").on("mousemove", function (evt) {
        var xClickPos = evt.pageX - $('#volumeProgressContainer').offset().left;
        var elemntLength = $('#volumeProgressContainer').css("width");
        elemntLength = parseInt(elemntLength.substring(0, elemntLength.length - 2));

        var p = (xClickPos / elemntLength) * 100;
        p = p > 100 ? 100 : p;

        if (evt.which == 1) {
            $("#playerVolumeSilder").val(p);
            $("#playerVolumeSilder").trigger("change");

            $("#playerVolume").css("width", p + "%");
        }
    });

    $("#volumeProgressContainer").on("click", function (evt) {
        var xClickPos = evt.pageX - $('#volumeProgressContainer').offset().left;
        var elemntLength = $('#volumeProgressContainer').css("width");
        elemntLength = parseInt(elemntLength.substring(0, elemntLength.length - 2));

        var p = (xClickPos / elemntLength) * 100;
        p = p > 100 ? 100 : p;

        $("#playerVolumeSilder").val(p);
        $("#playerVolumeSilder").trigger("change");

        $("#playerVolume").css("width", p + "%");
    });
}

$(function () {
    setupFileInputEvents();
    setupPlayerControls();
    setupVolumeControllerEvents();
});


// time prgress or INTERVAL has bug when press next quicly (because it is an async job)