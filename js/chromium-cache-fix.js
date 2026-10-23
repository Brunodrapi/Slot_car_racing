// Desktop Chrome/Edge cache. Other browser engines retain the original renderer.
window.installChromiumCacheFix = function(app, requestedScale=8) {
 const ua=navigator.userAgent;
 const eligible=!mobileDevice()&&/Chrome\/|Edg\//.test(ua)&&!/OPR\/|SamsungBrowser\//.test(ua);
 if(!eligible)return false;
 const r=app.renderer;
 window.installBackdropCachePrototype(r);
 const draw=r.draw,setTrack=r.setTrack;
 let building=false,preparedTrack=null,failedTrack=null,generation=0;
 r.chromiumCacheFix={enabled:true,requestedScale,building:false,error:null};
 r.setTrack=function(...args){generation++;preparedTrack=failedTrack=null;this.testBackdrop=false;if(!building)this.resetBackdrop();return setTrack.apply(this,args);};
 r.draw=function(race,ui,...rest){
  if(race&&preparedTrack!==race.track&&!building&&failedTrack!==race.track){
   const track=race.track,version=generation;
   building=true;this.chromiumCacheFix.building=true;this.testBackdrop=false;
   this.prepareBackdrop(race,ui,()=>{},requestedScale).then(()=>{
    if(generation===version){preparedTrack=track;this.testBackdrop=true;}
    else this.resetBackdrop();
   }).catch(error=>{failedTrack=track;this.testBackdrop=false;this.resetBackdrop();this.chromiumCacheFix.error=error.message;})
   .finally(()=>{building=false;this.chromiumCacheFix.building=false;});
  }
  return draw.call(this,race,ui,...rest);
 };
 return true;
};
