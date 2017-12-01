($ => {


    const POP_SND = new Audio("sounds/pop.mp3");
    const BUBBLE_SND = new Audio("sounds/bubbles.mp3");

    const INI_R = 25;
    const DEL_R = 1;
    const MAX_R = 250;
    const numbersPat = /[\d|,|.|e|E|\+]+/g;

    let setupDragState = () => $(".drawing-area .bubble").unbind("mousemove").unbind("mouseleave");
    let highlight = event => $(event.currentTarget).addClass("bubble-highlight");
    let unhighlight = event => $(event.currentTarget).removeClass("bubble-highlight");

    let inCreation = {};

    let startBubble = function (event) {
        BUBBLE_SND.play();
        $.each(event.touches, function (index, touch) {
            if (touch.target.movingBubble || inCreation[touch.identifier]) { return; }
            let canvas = $(touch.target);

            canvas.anchorX = touch.pageX - INI_R;
            canvas.anchorY = touch.pageY - INI_R;

            let position = { left: canvas.anchorX, top: canvas.anchorY };
            let velocity = { x: 0, y: 0, z: 0 };
            let acceleration = { x: 0, y: 0, z: 0 };

            let newBubble = $("<div></div>")
                .appendTo(canvas)
                .addClass("bubble")
                .data({position, velocity, acceleration})
                .offset(position)
                .bind("touchstart", highlight)
                .bind("touchstart", startMove)
                .bind("touchmove", trackDrag)
                .bind("touchend", endDrag)
                .bind("touchend", unhighlight);

            inCreation[touch.identifier] = newBubble;
            setupDragState();
        });
    };

    let inflateBubble = function (event) {
        $.each(event.changedTouches, function (index, touch) {
            if (touch.target.movingBubble) { return; }
            if (inCreation[touch.identifier]) {
                let currentBubble = inCreation[touch.identifier];

                let center = currentBubble.position();
                let centerX = center.left;
                let centterY = center.top;
                let fingerX = touch.pageX;
                let fingerY = touch.pageY;
                let delX = centerX - fingerX;
                let delY = centterY - fingerY;


                let r = +currentBubble.css('height').match(numbersPat);
                r += 2 * DEL_R;

                let newPosition = {
                    left: centerX - (delX + r / 2),
                    top: centterY - (delY + r / 2)
                };

                if (r >= MAX_R) {
                    POP_SND.play();
                    currentBubble.remove();
                    touch.target.movingBubble = null;
                    delete inCreation[touch.identifier];
                    if (jQuery.isEmptyObject(inCreation)) {
                        BUBBLE_SND.pause();
                    }
                } else {
                    currentBubble.css('height', `${r}px`);
                    currentBubble.css('width', `${r}px`);
                    currentBubble.data('position', newPosition);
                    currentBubble.offset(newPosition);
                }
            }
        });
    };

    let finishBubble = function (event) {
        $.each(event.changedTouches, function (index, touch) {
            delete inCreation[touch.identifier];
        });
        if (jQuery.isEmptyObject(inCreation)) {
            BUBBLE_SND.pause();
        }
    };

    let trackDrag = event => {
        $.each(event.changedTouches, function (index, touch) {
            if (inCreation[touch.identifier]) { return; }
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
    const FRAME_RATE = 60;
    const FRAME_DURATION = 1000 / FRAME_RATE;
    const MASS = 0.01;
    const BUOYANT_COEFFICIENT = 0.005;

    let lastTimestamp = 0;
    let bubbleBubbles = timestamp => {
        if (!lastTimestamp) {
            lastTimestamp = timestamp;
        }

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

            // The bouyant force is proportional to the radius of the bubble (not the real formula but looks right),
            // and opposite in direction to the acceleration of gravity
            // the MASS replicates the mass of water for the buoyancy equation

            v.x -= (a.x * BUOYANT_COEFFICIENT * radius * MASS);
            v.y -= (a.y * BUOYANT_COEFFICIENT * radius * MASS);
            v.z -= (a.z * BUOYANT_COEFFICIENT * radius * MASS);

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

    let setDrawingArea = jQueryElements => {
        jQueryElements
            .addClass("drawing-area")
            .each((index, element) => {
                element.addEventListener("touchstart", startBubble);
                element.addEventListener("touchmove", inflateBubble);
                element.addEventListener("touchend", finishBubble);
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
            // Simulate we are on an iphone ... just to make it more complicated and 'fair'
            // Skip if you are on an iphone
            let g = {x: -a.x, y: -a.y, z: -a.z};
            $("div.bubble").each((index, element) => {
                $(element).data('acceleration', g);
            });
        };

        window.requestAnimationFrame(bubbleBubbles);
    };

    $.fn.megaBubblesInit = function () {
        setDrawingArea(this);
        return this;
    };
})(jQuery);
