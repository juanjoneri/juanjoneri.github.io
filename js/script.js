$(function() {
    $('[data-toggle="tooltip"]').tooltip();
});

var video = document.getElementById('sitegif');
video.addEventListener('click',function(){
  video.play();
},false);
