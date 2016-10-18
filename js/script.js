$(function() {
    $('[data-toggle="tooltip"]').tooltip();
});

var video = document.getElementById('video');
video.addEventListener('click',function(){
  video.play();
},false);
