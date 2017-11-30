($ => {


    const POP_SND = new Audio("sounds/pop.mp3");
    const BUBBLE_SOUND = new Audio("sounds/bubbles.mp3");

    const INI_R = 25;
    const DEL_R = 1;
    const MAX_R = 250;
    const numbersPat = /[\d|,|.|e|E|\+]+/g;

    let setupDragState = () => $(".drawing-area .bubble").unbind("mousemove").unbind("mouseleave");
    let highlight = event => $(event.currentTarget).addClass("bubble-highlight");
    let unhighlight = event => $(event.currentTarget).removeClass("bubble-highlight");

    const delT = 100; // Time between creation of bubbles
    let lastT = new Date().getTime();


    let addBubble = function (event) {

        if (new Date().getTime() - lastT < delT) {
            return;
        }

        for (let i = 0; i < event.touches.length; i++) {
            let touch = event.touches[i];

            if (touch.target.movingBubble) {
                return;
            }

            BUBBLE_SOUND.play();

            this.anchorX = touch.pageX - INI_R;
            this.anchorY = touch.pageY - INI_R;
            let position = { left: this.anchorX, top: this.anchorY };
            let velocity = { x: 0, y: 0, z: 0 };
            let acceleration = { x: 0, y: 0, z: 0 };

            $("<div></div>")
                .appendTo(this)
                .addClass("bubble")
                .data({position, velocity, acceleration})
                .offset(position)
                .bind("touchstart", highlight)
                .bind("touchstart", startMove)
                .bind("touchmove", trackDrag)
                .bind("touchend", endDrag)
                .bind("touchend", unhighlight);

            setupDragState();
            lastT = new Date().getTime();
        }

    };

    let trackDrag = event => {
        $.each(event.changedTouches, function (index, touch) {
            if (touch.target.movingBubble) {

                touch.target.deltaX += DEL_R;
                touch.target.deltaY += DEL_R;

                let newPosition = {
                    left: touch.pageX - touch.target.deltaX,
                    top: touch.pageY - touch.target.deltaY
                };

                let r = +$(touch.target).css('height').match(numbersPat);
                r += 2 * DEL_R;

                $(touch.target).css('height', `${r}px`);
                $(touch.target).css('width', `${r}px`);

                $(touch.target).data('position', newPosition);
                $(touch.target).offset(newPosition);

                if (r >= MAX_R) {
                    POP_SND.play();
                    $(touch.target).remove();
                    touch.target.movingBubble = null;
                    lastT = new Date().getTime();
                }
            }
        });

        event.preventDefault();
    };

    let endDrag = event => {
        $.each(event.changedTouches, (index, touch) => {
            if (touch.target.movingBubble) {
                touch.target.movingBubble = null;
            }
        });
    };

    let startMove = event => {
        $.each(event.changedTouches, (index, touch) => {
            let targetBubble = $(touch.target);
            let startOffset = targetBubble.offset();
            targetBubble.data({
                position: startOffset,
                velocity: { x: 0, y: 0, z: 0 },
                acceleration: { x: 0, y: 0, z: 0 }
            });

            touch.target.movingBubble = targetBubble;
            touch.target.deltaX = touch.pageX - startOffset.left;
            touch.target.deltaY = touch.pageY - startOffset.top;
        });

        event.stopPropagation();
    };

    const FRICTION_FACTOR = 0.95;
    const BOUYANT_COEFFICIENT = 0.005;
    const FRAME_RATE = 120;
    const FRAME_DURATION = 1000 / FRAME_RATE;
    const MASS = 0.01;

    let lastTimestamp = 0;
    let bubbleBubbles = timestamp => {
        if (!lastTimestamp) {
            lastTimestamp = timestamp;
        }

        // Keep that frame rate under control.
        if (timestamp - lastTimestamp < FRAME_DURATION) {
            window.requestAnimationFrame(bubbleBubbles);
            return;
        }

        $("div.bubble").each((index, element) => {
            let $element = $(element);

            if ($element.hasClass("bubble-highlight")) {
                return;
            }

            let s = $element.data('position');
            let v = $element.data('velocity');
            let a = $element.data('acceleration');

            let radius = +$element.css('height').match(numbersPat);

            s.left += v.x;
            s.top -= v.y;

            v.x += (a.x * BOUYANT_COEFFICIENT * radius * MASS);
            v.y += (a.y * BOUYANT_COEFFICIENT * radius * MASS);
            v.z += (a.z * BOUYANT_COEFFICIENT * radius * MASS);

            v.x *= FRICTION_FACTOR;
            v.y *= FRICTION_FACTOR;
            v.z *= FRICTION_FACTOR;

            let $parent = $element.parent();
            let bounds = {
                left: $parent.offset().left,
                top: $parent.offset().top
            };

            bounds.right = bounds.left + $parent.width();
            bounds.bottom = bounds.top + $parent.height();

            if ((s.left <= bounds.left) || (s.left + $element.width() > bounds.right)) {
                s.left = (s.left <= bounds.left) ? bounds.left : bounds.right - $element.width();
                v.x = -v.x;
            }

            if ((s.top <= bounds.top) || (s.top + $element.height() > bounds.bottom)) {
                s.top = (s.top <= bounds.top) ? bounds.top : bounds.bottom - $element.height();
                v.y = -v.y;
            }

            $(element).offset(s);
        });

        lastTimestamp = timestamp;
        window.requestAnimationFrame(bubbleBubbles);
    };

    let stopSound = function () {
        BUBBLE_SOUND.pause();
    };

    let setDrawingArea = jQueryElements => {
        jQueryElements
            .addClass("drawing-area")
            .each((index, element) => {
                element.addEventListener("touchmove", addBubble, false);
                element.addEventListener("touchend", stopSound);
            })
            .find("div.bubble").each((index, element) => {
                $(element)
                    .bind("touchstart", highlight)
                    .bind("touchstart", startMove)
                    .bind("touchmove", trackDrag)
                    .bind("touchend", endDrag)
                    .bind("touchend", unhighlight)
                    .data({
                        position: $(element).offset(),
                        velocity: { x: 0, y: 0, z: 0 },
                        acceleration: { x: 0, y: 0, z: 0 }
                    });
            });

        window.ondevicemotion = event => {
            let a = event.accelerationIncludingGravity;
            $("div.bubble").each((index, element) => {
                $(element).data('acceleration', a);
            });
        };

        window.requestAnimationFrame(bubbleBubbles);
    };

    $.fn.megaBubblesInit = function () {
        setDrawingArea(this);
        return this;
    };
})(jQuery);
