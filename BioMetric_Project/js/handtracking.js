var HT = HT || {};

HandTracker = function(params){
  this.params = params || {};
  this.mask = new CV.Image();
  this.eroded = new CV.Image();
  this.contours = [];  
  this.skinner = new HandSkinner();
};

HandTracker.prototype.detect = function(image){
  this.skinner.mask(image, this.mask);  
  if (this.params.fast){
    this.blackBorder(this.mask);
  }else{
    CV.erode(this.mask, this.eroded);
    CV.dilate(this.eroded, this.mask);
  }
  this.contours = CV.findContours(this.mask);
  return this.findCandidate(this.contours, image.width * image.height * 0.05, 0.005);
};

HandTracker.prototype.findCandidate = function(contours, minSize, epsilon){
  var contour, candidate = {candidate1:null,candidate2:null},poly;
  //Get top two contours maximum in the size
  contour = this.findMaxArea(contours, minSize);

  if (contour.contour1 != null){      
    poly = CV.approxPolyDP(contour.contour1, contour.contour1.length * epsilon);
    //getConvexHull and Defects
    candidate.candidate1 = new HandCandidate(poly);
    //locus of hull and defects was used earlier..but failed to perform
    //It is uncommented to show its plot in the user view
    candidate.candidate1.center = this.locus(candidate.candidate1);    
    //Filter Defects for Hull
    candidate.candidate1.defects = this.filterDefects(candidate.candidate1);
    //Filter Convex Hull Vertices, and decide its hand or not
    if(!this.validHand(candidate.candidate1)){
        candidate.candidate1  = null;
    }     
  }
  
  if (contour.contour2 != null){
    poly = CV.approxPolyDP(contour.contour2, contour.contour2.length * epsilon);
    //getConvexHull and Defects
    candidate.candidate2 = new HandCandidate(poly);
    //locus of hull and defects was used earlier..but failed to perform
    //It is uncommented to show its plot in the user view
    candidate.candidate2.center = this.locus(candidate.candidate2);
    //Filter Defects for Hull
    candidate.candidate2.defects = this.filterDefects(candidate.candidate2);
    //Filter Convex Hull Vertices
    if(!this.validHand(candidate.candidate2)){
        candidate.candidate2  = null;
    }    
  }  
  return candidate;
};

//Finding the Center of Hull and Convexity Defects for creating classifier
HandTracker.prototype.locus = function(candidate){    
    var center={x:null,y:null,x1:null,y1:null};
    var hull = candidate.hull;    
    for(var i=0;i<hull.length;i++){
        center.x += hull[i].x;
        center.y +=  hull[i].y;        
    }        
    center.x = center.x/hull.length;
    center.y = center.y/hull.length;
       
    var defects = candidate.defects;
    
    for(var i=0;i<defects.length;i++){
        center.x1 += defects[i].depthPoint.x;
        center.y1 +=  defects[i].depthPoint.y;        
    }        
    center.x1 = center.x1/defects.length;
    center.y1 = center.y1/defects.length;  
    return center;
}

//define the major axis and the orientation

//HandTracker.prototype.filter = function(candidate){
//    var positiveX = 0 ,positiveY = 0,negativeX = 0 ,negativeY = 0;
//    var posXC = 0,posYC = 0 ,negXC = 0,negYC = 0;
//    var hull = candidate.hull;
//    var center = candidate.center;
//    var defects = candidate.defects;
// 
//    for(var i=0;i<hull.length;i++){         
//        var diff = center.y1 - hull[i].y;         
//        if(diff < 0){negativeY += diff; negYC += 1;}
//        else{positiveY += diff; posYC += 1;}
//        
//        diff  = center.x1 - hull[i].x;
//        if(diff < 0){negativeX += diff; negXC += 1;}
//        else{positiveX += diff; posXC += 1;}
//    }    
//    
//   var close = 0;  
//   var largerDefects = 0;
//   var largerHull = posYC;
//    
//   for(var i=0;i<defects.length;i++){
//       if(defects[i].depth < 8){
//            close++;
//       }           
//       if( Math.abs(defects[i].start.y - defects[i].depthPoint.y) && Math.abs(defects[i].start.y) ){
//           largerDefects++;
//       }
//    } 
// 
//    
//    candidate.largerHull = largerHull;
//    candidate.largerDefects = largerDefects;
//    
//    if(Math.abs(candidate.hull.length - candidate.defects.length) > 5 || close > 0.7*defects.length || 
//       Math.abs(positiveX - 1*negativeX - positiveY - 1*negativeY) > 400){
//        return null;
//    }    
//
//    if(positiveX - 1*negativeX > positiveY - 1*negativeY){
//        candidate.orientation = "Horizotal";
//    }else{
//        if(posYC > negYC){
//          candidate.type = "Normal";  
//        }
//        candidate.orientation = "Verticle";
//    }  
//}

//HandTracker.prototype.sort = function(defects,center){
//  var leftLowerDefect = {depthPoint:{x:Infinity,y:Infinity}};
//  var outDefects = Array(defects.length);
//  var pos = 0;
//  //Finding the starting point
//  for(var i=0;i<defects.length;i++){
//      if(defects[i].depthPoint.y > center.y)
//               if(defects[i].depthPoint.x < leftLowerDefect.depthPoint.x){
//                   leftLowerDefect = defects[i];
//                   pos = i;
//               }
//  }
//  outDefects[0] = leftLowerDefect;
//  defects[pos] = null;
//
////start Ordering
//  for(var j=0;j<defects.length-1;j++){//searching for remaining
//      var next = {depthPoint:{x:Infinity,y:Infinity}};
//      
//      //search valid next
//      for(var k=0;k<defects.length;k++){           
//            if(defects[k]!=null)
//                    if(defects[k].depthPoint.x <= next.depthPoint.x && 
//                      defects[k].depthPoint.y < next.depthPoint.y){
//                        next = defects[k];
//                        pos = k;
//                    }
//      }
//     outDefects[j+1] = next;
//     defects[pos] = null;     
// }
//
// var close = 0;
//     
// for(var i=0;i<outDefects.length;i++){
//    if(outDefects[i].depth < 10){
//         close++;
//    }
// } 
//// if(close > 0.5*outDefects.length){
////     return null;
//// }
//  return outDefects;
//};

//<editor-fold defaultstate="collapsed" desc="Filter Defects">
HandTracker.prototype.filterDefects = function(candidate){    
    var outdefects = [];    
    var defects = candidate.defects;
    var boundingBox = candidate.boundingBox;
    var maxAngle = -Infinity;
    var j = 0; 
        
    for(var i = 0; i < defects.length; i++ ){        
        var defToStart = Math.sqrt(Math.pow(defects[i].start.x - defects[i].depthPoint.x,2) + Math.pow(defects[i].start.y - defects[i].depthPoint.y,2));
        var defToEnd = Math.sqrt(Math.pow(defects[i].end.x - defects[i].depthPoint.x,2) + Math.pow(defects[i].end.y - defects[i].depthPoint.y,2));
        var startToEnd = Math.sqrt(Math.pow(defects[i].end.x - defects[i].start.x,2) + Math.pow(defects[i].end.y - defects[i].start.y,2));
        var angle = Math.acos( ( Math.pow(defToStart,2) + Math.pow(defToEnd,2) - Math.pow(startToEnd,2) ) / (2 * defToStart * defToEnd ));
  
        if(angle < 1.8 && startToEnd < 0.9*boundingBox.width &&  
           defToEnd < 0.4*boundingBox.height && 
           defToStart < 0.4*boundingBox.height &&
           defects[i].depthPoint.y < (boundingBox.bottomY - boundingBox.height/2)){  
           outdefects[j++] = defects[i];
           if(angle > maxAngle){
               candidate.maxDefect = defects[i];
           }
        }        
    }      
    return outdefects;
}
//</editor-fold>

//check for the validity of Hand..If is not hand make it blank..if it is populate 
//it with the finger information
HandTracker.prototype.validHand = function(candidate){  
    var fingers = [];        
    var isIt = this.validHandStructure(candidate); //remove faces and flat background 
    
    if(!isIt){
      return false;
    }
    
    if(candidate.defects.length == 0){ //find the posibility of single finger        
            //TRIAL 1: By finding the %of numbers of hull in the top area
            //        var topY = candidate.boundingBox.topY;
            //        var height = candidate.boundingBox.height;
            //        var count = 0;
            //        var top = {x:Infinity,y:Infinity}
            //        
            //        for(var i = 0;i<candidate.hull.length;i++){
            //              if(Math.abs(candidate.hull[i].y - topY)< 0.4*height){ 
            //                  //find boundigBox top bounding points
            //                  count++;
            //                  if(candidate.hull[i].y < top.y){//top most point for single finger
            //                      top.x = candidate.hull[i].x;
            //                      top.y = candidate.hull[i].y;
            //                  }
            //              }                   
            //        }        
            //        candidate.type = "Closed Palm";
            //        if(count < 5){
            //           fingers[0] = top; //for single finger number of filter hull should be 2 or 1
            //           candidate.type = "One Fingers";
            //        }
         
//By finding the distance between the top point to the mid hull point distance
         var hull = JSON.parse(JSON.stringify(candidate.hull));
    
         //sorting hull points from 
         for(var i = 0;i<hull.length - 1;i++){
             for(var j =i+1;j<hull.length;j++){
                if(hull[i].y > hull[j].y){
                    var temp = hull[i];
                    hull[i] = hull[j];
                    hull[j] = temp;
                }   
             }
         } 
         
            //TRAIL 2: Tried to find the maximum slope change by taking the mid hull point(y direction) after sorting
            //         var half = Math.round(hull.length/2);      
            //         if(Math.abs(hull[0].y - hull[1].y) <
            //             0.15 * candidate.boundingBox.height){
            ////             candidate.type = "Closed Palm";
            //         }else{
            ////           candidate.type = "One Finger";  
            //           fingers[0] = {x:hull[0].x,y:hull[0].y};  
            //         } 

            //TRAIL:3 Finding the rate of change of Y co-ordinate of all the hulls for close palm(in uppar part of bounding box) 
            //        With the top most point in the convex hull
                     var change = [];
                     for(var i = 0;i<hull.length;i++){
                         if(hull[i].y < candidate.boundingBox.height){
                           change[i] = hull[i].y - hull[0].y;   
                         }else{
                             change[i] = 0;
                         }
                     }

                     for(var i = 0;i<change.length;i++){
                         //If it any convex hull is far apart, it stand for single finger point
                         if(change[i] > 0.2*candidate.boundingBox.height ){
                             fingers[0] = {x:hull[0].x,y:hull[0].y};
                             break;
                         }
                     }         
       
    }else if(candidate.defects.length  == 1){ //if single defect is found.....also find the hand type    
        fingers[0] = { x:candidate.defects[0].start.x, y:candidate.defects[0].start.y };
        fingers[1] = { x:candidate.defects[0].end.x, y:candidate.defects[0].end.y };
    }else{ //for multiple defects
        this.sortDefects(candidate); // sort all the defects  
        var defects = candidate.defects;
        var j = 0;         
        //Find the tip of the fingers..We need to avoid the multiple convexhull 
        //points on the single finger. additionally order of start and end point for any 
        //defect is not same..hence created order dynamically
        for(var i = 0;i<defects.length;i++){
            if(i == 0){//for single defect both sides are fingers
               fingers[j++] = {x:defects[i].start.x,y:defects[i].start.y};  
               fingers[j++] = {x:defects[i].end.x,y:defects[i].end.y};
            }
            if(i != 0){ //if incase reverse order of start and end point..
                //Checking is done based on the type of Hand
               if(candidate.type == 'R' || candidate.type == 'N'){
                     if(defects[i].start.x < defects[i].end.x){
                       fingers[j++] = {x:defects[i].start.x,y:defects[i].start.y};  
                     }else{
                       fingers[j++] = {x:defects[i].end.x,y:defects[i].end.y};   
                     }
               }else{
                   if(defects[i].start.x > defects[i].end.x){
                       fingers[j++] = {x:defects[i].start.x,y:defects[i].start.y};  
                   }else{
                       fingers[j++] = {x:defects[i].end.x,y:defects[i].end.y};   
                   }
               }
            } 
        }             
   }   
   candidate.fingers = fingers;
   return true;
};

HandTracker.prototype.validHandStructure = function(candidate){ 
//TRIAL 1:Used 
//******Used Contour for removing faces ***** 
// var contour = candidate.contour;
// var bottomY = candidate.boundingBox.bottomY;
// var height = candidate.boundingBox.height;
// var count = 0;
// for(var i = 0;i < contour.length; i++){
//    if(Math.abs(contour[i].y - bottomY) < 0.1*height){
//       count++; 
//    }
// }
// if(count > 0.1 * candidate.boundingBox.width){
//     return false;
// }
// return true;

//**** Using number of hull for face removal *****//
 if(candidate.hull.length < 1){//atleast one hull require to take decision
     return false;
 }
 
 var hull = candidate.hull;
 var bottomY = candidate.boundingBox.bottomY;
 var height = candidate.boundingBox.height;
 var count = 0;
 for(var i = 0;i < hull.length; i++){
    if(Math.abs(hull[i].y - bottomY) < 0.5*height){
       count++; 
    }
 }
 
 if(count > 4){//minimum count decided after number of rounds
     return false;
 } 
 return true;
};

//defect Sorting and finding the type of Hand
HandTracker.prototype.sortDefects = function(candidate){
    
     var lowest = null;  
     var slowest = null;
     
    //find the lowest defects...to find the hand type and hence order of sorting for fingers
    for(var i=0;i<candidate.defects.length;i++){
       if(lowest == null){
       if(candidate.defects[i].depthPoint.x != candidate.maxDefect.depthPoint.x &&
          candidate.defects[i].depthPoint.y != candidate.maxDefect.depthPoint.y)
          lowest = candidate.defects[i];
      }else{
            if(lowest.depthPoint.y < candidate.defects[i].depthPoint.y && 
                candidate.defects[i].depthPoint.x != candidate.maxDefect.depthPoint.x &&
                candidate.defects[i].depthPoint.y != candidate.maxDefect.depthPoint.y){          
                lowest = candidate.defects[i];
         }
      } 
   }   
    
   if( Math.abs(candidate.maxDefect.depthPoint.y - lowest.depthPoint.y) > 
        Math.abs(candidate.maxDefect.depthPoint.x - lowest.depthPoint.x)){
        //Thumb is present...we have starting point
        if(lowest.depthPoint.x - candidate.maxDefect.depthPoint.x > 0){
            candidate.type = "R";
            //perform sorting accordingly            
            //sort the defects
            for(var i = 0;i<candidate.defects.length - 1 ;i++){
               for(var j = i + 1;j<candidate.defects.length;j++){
                   if(candidate.defects[i].depthPoint.x > candidate.defects[j].depthPoint.x){
                       var temp = candidate.defects[i];
                       candidate.defects[i] = candidate.defects[j];
                       candidate.defects[j] = temp;
                   }
               }            
            } 
        }else{
            candidate.type = "L";
            //perform sorting accordingly
            for(var i = 0;i<candidate.defects.length - 1 ;i++){
               for(var j = i + 1;j<candidate.defects.length;j++){
                   if(candidate.defects[i].depthPoint.x > candidate.defects[j].depthPoint.x){
                       var temp = candidate.defects[i];
                       candidate.defects[i] = candidate.defects[j];
                       candidate.defects[j] = temp;
                   }
               }            
            }
        }
    }else{
         candidate.type = "R";
//         console.log("Generic Gesture"); 
            //perform sorting accordingly
         for(var i = 0;i<candidate.defects.length - 1 ;i++){
               for(var j = i + 1;j<candidate.defects.length;j++){
                   if(candidate.defects[i].depthPoint.x < candidate.defects[j].depthPoint.x){
                       var temp = candidate.defects[i];
                       candidate.defects[i] = candidate.defects[j];
                       candidate.defects[j] = temp;
                   }
               }            
         }        
    }
    return;
};    

//find top two biggest cotours 
HandTracker.prototype.findMaxArea = function(contours, minSize){
  var len = contours.length, i = 0,
      maxArea1 = -Infinity,maxArea2 = -Infinity,area,contoursOut = {contour1:null,contour2:null};

  for (; i < len; ++ i){
    area = CV.area(contours[i]);
    if (area >= minSize){    
      if (area > maxArea1){
        maxArea1 = area;     
        contoursOut.contour2 = contoursOut.contour1;
        contoursOut.contour1 = contours[i];
      }else if (area > maxArea2){
         contoursOut.contour2 = contours[i]; 
      }      
    }
  }  
  return contoursOut;
};
HandTracker.prototype.blackBorder = function(image){
  var img = image.data, width = image.width, height = image.height,
      pos = 0, i;

  for (i = 0; i < width; ++ i){
    img[pos ++] = 0;
  }
  
  for (i = 2; i < height; ++ i){
    img[pos] = img[pos + width - 1] = 0;

    pos += width;
  }

  for (i = 0; i < width; ++ i){
    img[pos ++] = 0;
  }
  
  return image;
};
//Form Convex Hull and Convexity Defects
HandCandidate = function(contour){
  this.contour = contour;
  this.boundingBox = CV.boundingBox(contour);
  this.hull = CV.convexHull(contour);
  this.defects = CV.convexityDefects(contour, this.hull);
};
HandSkinner = function(){
};
HandSkinner.prototype.mask = function(imageSrc, imageDst){
  var src = imageSrc.data, dst = imageDst.data, len = src.length,
      i = 0, j = 0,
      r, g, b, h, s, v, value;
  for(; i < len; i += 4){
    r = src[i];
    g = src[i + 1];
    b = src[i + 2];
  
    v = Math.max(r, g, b);
    s = v === 0? 0: 255 * ( v - Math.min(r, g, b) ) / v;
    h = 0;
    
    if (0 !== s){
      if (v === r){
        h = 30 * (g - b) / s;
      }else if (v === g){
        h = 60 + ( (b - r) / s);
      }else{
        h = 120 + ( (r - g) / s);
      }
      if (h < 0){
        h += 360;
      }
    }
    value = 0;
    if (v >= 15 && v <= 250){
      if (h >= 3 && h <= 33){
        value = 255;
      }
    }    
    dst[j++] = value;
  }  
  imageDst.width = imageSrc.width;
  imageDst.height = imageSrc.height;  
  return imageDst;
};