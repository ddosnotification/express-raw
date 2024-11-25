function detectDevTools() {
    return {
      getScript() {
        return `
          window.devToolsOpen = false;
          
          const checkDevTools = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            return widthThreshold || heightThreshold;
          };
          
          setInterval(() => {
            window.devToolsOpen = checkDevTools();
          }, 1000);
   
          return window.devToolsOpen;
        `;
      },
   
      injectCheck(htmlContent) {
        return `
          <script>${this.getScript()}</script>
          ${htmlContent}
        `;
      }
    };
   }
   
module.exports = detectDevTools;