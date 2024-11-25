function mouseTracker({ trackingTime }) {
    if (!trackingTime || typeof trackingTime !== 'number') {
      throw new Error('mouseTracker requires trackingTime (in ms) in configuration');
    }
   
    return {
      getScript() {
        return `
          const movements = [];
          let lastPos = { x: 0, y: 0 };
          let startTime = Date.now();
          
          document.addEventListener('mousemove', (e) => {
            if (Date.now() - startTime > ${trackingTime}) return;
            
            movements.push({
              x: e.clientX,
              y: e.clientY,
              time: Date.now() - startTime
            });
            
            lastPos = { x: e.clientX, y: e.clientY };
          });
   
          setTimeout(() => {
            const analysis = analyzeMovements(movements);
            console.log(JSON.stringify(analysis));
          }, ${trackingTime});
   
          function analyzeMovements(moves) {
            if (moves.length < 2) return { isBot: true, confidence: 1 };
            
            const speeds = [];
            const angles = [];
            
            for (let i = 1; i < moves.length; i++) {
              const dx = moves[i].x - moves[i-1].x;
              const dy = moves[i].y - moves[i-1].y;
              const dt = moves[i].time - moves[i-1].time;
              
              speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
              angles.push(Math.atan2(dy, dx));
            }
   
            const speedVariance = getVariance(speeds);
            const angleVariance = getVariance(angles);
            const straightLines = countStraightLines(angles);
            
            const botMetrics = {
              lowSpeedVariance: speedVariance < 0.1,
              lowAngleVariance: angleVariance < 0.1,
              tooManyStraightLines: straightLines > moves.length * 0.8
            };
   
            const botScore = Object.values(botMetrics).filter(Boolean).length / 3;
   
            return {
              isBot: botScore > 0.6,
              confidence: botScore,
              metrics: botMetrics,
              data: {
                speedVariance,
                angleVariance,
                straightLines,
                totalMoves: moves.length
              }
            };
          }
   
          function getVariance(arr) {
            const mean = arr.reduce((a,b) => a + b) / arr.length;
            return arr.reduce((a,b) => a + (b - mean) ** 2, 0) / arr.length;
          }
   
          function countStraightLines(angles) {
            let straight = 0;
            for (let i = 1; i < angles.length; i++) {
              if (Math.abs(angles[i] - angles[i-1]) < 0.1) straight++;
            }
            return straight;
          }
        `;
      }
    };
   }
   
module.exports = mouseTracker;