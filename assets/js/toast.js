function showToastMessage(message, showMiliseconds) {
    if ($("#toastMessage").length == 0) {
        $("body").append('<div id="toastContainer"><div id="toastMessage"></div></div>');
    }

    var toastMessage = $("#toastMessage");
    toastMessage.html(message);
    toastMessage.addClass("active");

    setTimeout(function () {
        toastMessage.removeClass("active");
    }, (showMiliseconds || 2000));
}