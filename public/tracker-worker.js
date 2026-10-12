/* Classic worker: pinned MediaPipe CommonJS bundle; CPU WASM keeps inference off UI. */
let tracker;
self.onmessage=async ({data})=>{
  try{
    if(data.type==='init'){
      if (!data.model) self.exports={};
      if (!data.model) importScripts('./vendor/vision_bundle.js');
      const vision=self.exports;
      const files=data.model ? {wasmLoaderPath:EMBEDDED_LOADER,wasmBinaryPath:data.binaryUrl} : await vision.FilesetResolver.forVisionTasks(new URL('./vendor/wasm',self.location.href).href);
      tracker=await vision.FaceLandmarker.createFromOptions(files,{baseOptions:{...(data.model ? {modelAssetBuffer:data.model} : {modelAssetPath:new URL('./vendor/face_landmarker.task',self.location.href).href}),delegate:'CPU'},canvas:new OffscreenCanvas(640,480),runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,minTrackingConfidence:.55});
      self.postMessage({type:'ready'});
    }else if(data.type==='frame'){
      const start=performance.now();let result;
      try{result=tracker.detectForVideo(data.bitmap,data.timestamp);}finally{data.bitmap.close();}
      const scores={};for(const c of result.faceBlendshapes?.[0]?.categories||[])scores[c.categoryName]=c.score;
      self.postMessage({type:'result',landmarks:result.faceLandmarks[0]||null,smile:((scores.mouthSmileLeft||0)+(scores.mouthSmileRight||0))/2,jaw:scores.jawOpen||0,ms:performance.now()-start});
    }
  }catch(error){self.postMessage({type:'error',message:error.message||String(error)});}
};
