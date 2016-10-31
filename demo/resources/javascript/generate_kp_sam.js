$(document).ready(function() {
    var mode = 'pp'; // default to bounding box
    var canvas, context, startX, endX, startY, endY;
    var mouseIsDown = 0;
    var option_selected = null; 

    canvas = document.getElementById("pp_canvas");
    context = canvas.getContext("2d");

    /*Canvas variables:*/
	var num_kps = 15;
	var pointnames = 'BACK,BEAK,BELY,BRST,CRWN,FRHD,LEYE,LLEG,LWNG,NAPE,REYE,RLEG,RWING,TAIL,THRT'.split(',');
	var kp_coors;
	var dragIndex;
	var dragging;
	var mouseX;
	var mouseY;
	var timer;
	var targetX;
	var targetY;

    // Ajax requests
    function get_bb_prediction() {
        var description = $('#description').val();
        var showkps = $('#showkps').val();
        var obj = {
            x: startX, 
            y: startY, 
            width: Math.abs(endX - startX),
            height: Math.abs(endY - startY), 
            description: description,
            showkps: showkps
        }; 

        $.ajax({
            data: obj,
            url: 'request',
            type: "GET",
            success: function (msg) {
                console.log(msg)
                context.clearRect(0, 0, canvas.width, canvas.height);
                $('.placeholder').attr('src', msg)
            },
            error: function (msg) { ret = 'Epic fail!'; },
            async: false,
            timeout: 10000,
        });
    }
    
    function get_pp_prediction() {
        var description = $('#pp_description').val();
        var showkps = $('#pp_showkps').is(":checked") ? 1 : 0;
        // window.alert("!" + showkps);
        var keypoints = []; 

        for (var i = 0; i < num_kps; i++) {
            var current_child = kp_coors[i];
            
            if(current_child.x > 256*2) { continue; }

            var x = current_child.x; 
            var y = current_child.y; 
            var part_id = current_child.id; 
            var keypoint_obj = {
                x: x/2,
                y: y/2,
                part_id: (''+(part_id+1)),
            };

            keypoints.push(keypoint_obj);
            console.log(keypoints);
        }

        var obj = {
            description: description, 
            keypoints: keypoints,
            showkps: showkps
        };

        $.ajax({
            data: { "data" : JSON.stringify(obj) },
            url: 'request',
            type: "POST",
            success: function (msg) {
                console.log(msg)
                $('.placeholder').attr('src', msg)
            },
            error: function (msg) { ret = 'Epic fail!'; },
            async: true,
            contentType: "application/json",
            timeout: 10000,
        });
    }

    // Event listeners
    $('#generate_btn').click(function () {
        get_bb_prediction(); 
    });
    $('#pp_generate_btn').click(function () {
        get_pp_prediction(); 
    });

    // When enter is pressed, execute prediction
    document.getElementById("pp_description").addEventListener("keydown", function(e) {
        if (!e) { var e = window.event; }
        // Enter is pressed
        if (e.keyCode == 13) { 
            e.preventDefault(); // sometimes useful
            get_pp_prediction(); 
        }
    }, false);

    $("#pp_clear_btn").click(function () {
        init();
        document.getElementById('pp_description').value='';
    });


    /*******************
     * Canvas methods:
     *******************/
        init();


	function top_shape() {
		return kp_coors[num_kps-1];
	}

	function init() {
		kp_coors = [];
		makekp_coors();
		drawScreen();
		canvas.addEventListener("mousedown", mouseDownListener, false);
	}

	function preferred_position(id) {
		var xinit = (256+32)*2;
		var yinit = 32*2;
		var rows = 13; var vspace = 28*2;
		var cols = 2; var hspace = 72*2;
		return {x:xinit + (id%cols)*hspace,
			y:yinit + (((id-id%cols)/cols)%rows)*vspace};
	}
	function makekp_coors() {
		var i;
		for(i=0; i!=num_kps; i++) {
			var xy = preferred_position(i);
			var tempShape = new DragDisk(xy.x, xy.y, pointnames[i], i);
			kp_coors.push(tempShape);
		}
	}

	function mouseDownListener(evt) {
		var i;

		//getting mouse position correctly
		var bRect = canvas.getBoundingClientRect();
		mouseX = (evt.clientX - bRect.left)*(canvas.width/bRect.width);
		mouseY = (evt.clientY - bRect.top)*(canvas.height/bRect.height);

		for (i=0; i!=num_kps; i++) {
			if (kp_coors[i].hitTest(mouseX, mouseY)) {
				dragging = true;
				//the following variable will be reset if this loop repeats with another successful hit:
				dragIndex = i;
			}
		}

		if (dragging) {
			window.addEventListener("mousemove", mouseMoveListener, false);

			//place currently dragged shape on top
			kp_coors.push(kp_coors.splice(dragIndex,1)[0]);

			//The "target" position is where the object should be
			targetX = kp_coors[num_kps-1].x;
			targetY = kp_coors[num_kps-1].y;

			//start timer
			timer = setInterval(onTimerTick, 1000/30);
		}
		canvas.removeEventListener("mousedown", mouseDownListener, false);
		window.addEventListener("mouseup", mouseUpListener, false);

		//prevent mouse-down from affecting main browser window:
		if(evt.preventDefault) { evt.preventDefault(); }
		return false;
	}

	function onTimerTick() {
		//because of reordering, the dragging shape is the last one in the array.
		kp_coors[num_kps-1].x = targetX;
		kp_coors[num_kps-1].y = targetY;

		//stop the timer when the target position is reached (close enough)
		if(!dragging) {
			kp_coors[num_kps-1].x = targetX;
			kp_coors[num_kps-1].y = targetY;
			//stop timer:
			clearInterval(timer);
		}
		drawScreen();
	}

	function mouseUpListener(evt) {
		if(kp_coors[num_kps-1].x > 256*2) {
		    var xy = preferred_position(kp_coors[num_kps-1].id);
		    kp_coors[num_kps-1].y = targetY = xy.y;
		    kp_coors[num_kps-1].x = targetX = xy.x;
		    drawScreen();
		}

		canvas.addEventListener("mousedown", mouseDownListener, false);
		window.removeEventListener("mouseup", mouseUpListener, false);
		if (dragging) {
			dragging = false;
			window.removeEventListener("mousemove", mouseMoveListener, false);
		}
	}

	function ensure_bounds(minn,maxx, val) {
		if(val<minn) {return minn;}
		if(val>maxx) {return maxx;}
		return val;
	}
	function mouseMoveListener(evt) {
		//getting mouse position correctly
		var bRect = canvas.getBoundingClientRect();
        	mouseY = (evt.clientY - bRect.top)*(canvas.height/bRect.height);
		mouseX = (evt.clientX - bRect.left)*(canvas.width/bRect.width);

		//ensure target point within bounds of canvas
        	targetY = ensure_bounds(0, canvas.height, mouseY);
		targetX = ensure_bounds(0, canvas.width, mouseX);
	}

	function drawkp_coors() {
        	context.clearRect(0, 0, canvas.width, canvas.height);
		var i;
		for (i=0; i!=num_kps; i++) {
			kp_coors[i].drawToContext(context);
		}
	}

	function drawScreen() {
		drawkp_coors();
	}
});
