document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const runWorkflowBtn = document.getElementById('run-workflow');
    const clearLogsBtn = document.getElementById('clear-logs');
    const taskInput = document.getElementById('task-input');
    const logsContainer = document.getElementById('logs');
    const streamFrame = document.getElementById('stream-frame');
    const streamPlaceholder = document.getElementById('stream-placeholder');
    const sandboxIdSpan = document.getElementById('sandbox-id');
    const exampleTaskBtns = document.querySelectorAll('.example-task');
    const stopDesktopBtn = document.getElementById('stop-desktop');
    const sandboxTimerSpan = document.getElementById('sandbox-timer');
    const sandboxControlsDiv = document.getElementById('sandbox-controls');
    
    // WebSocket connection and timer variables
    let socket = null;
    let timerInterval = null;
    let sandboxTimeout = 1200; // Default timeout in seconds (will be updated from server)
    
    // Connect to WebSocket
    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function(e) {
            addLog('WebSocket connection established', 'info');
        };
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            switch(data.type) {
                case 'stdout':
                    addLog(data.data, 'stdout', data.timestamp);
                    break;
                case 'stderr':
                    addLog(data.data, 'stderr', data.timestamp);
                    break;
                case 'info':
                    addLog(data.data, 'info');
                    break;
                case 'error':
                    addLog(data.data, 'error');
                    break;
                case 'desktop_started':
                    handleDesktopStarted(data.data);
                    break;
                case 'desktop_killed':
                    handleDesktopKilled();
                    break;
                case 'task_completed':
                    addLog(data.data, 'success');
                    break;
                default:
                    addLog(JSON.stringify(data), 'info');
            }
        };
        
        socket.onclose = function(event) {
            if (event.wasClean) {
                addLog(`WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`, 'info');
            } else {
                addLog('WebSocket connection died', 'error');
                // Try to reconnect after a delay
                setTimeout(connectWebSocket, 3000);
            }
        };
        
        socket.onerror = function(error) {
            addLog(`WebSocket error: ${error.message}`, 'error');
        };
    }
    
    // Add log entry to the logs container
    function addLog(message, type = 'info', timestamp = null) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        
        if (timestamp) {
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'log-timestamp';
            timestampSpan.textContent = `[${timestamp}]`;
            logEntry.appendChild(timestampSpan);
        } else {
            const now = new Date();
            const timestampStr = now.toTimeString().split(' ')[0];
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'log-timestamp';
            timestampSpan.textContent = `[${timestampStr}]`;
            logEntry.appendChild(timestampSpan);
        }
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        logEntry.appendChild(messageSpan);
        
        logsContainer.appendChild(logEntry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
    
    // Handle desktop started event
    function handleDesktopStarted(data) {
        // Update UI
        
        // Show sandbox ID
        if (data.sandbox_id) {
            sandboxIdSpan.textContent = `Sandbox ID: ${data.sandbox_id}`;
        }
        
        // Load stream URL in iframe
        if (data.stream_url) {
            streamFrame.src = data.stream_url;
            streamFrame.style.display = 'block';
            streamPlaceholder.style.display = 'none';
        }
        
        // Enable stop button
        stopDesktopBtn.disabled = false;
        stopDesktopBtn.classList.add('btn-danger');
        stopDesktopBtn.classList.remove('btn-secondary');
        
        // Show sandbox controls
        sandboxControlsDiv.style.display = 'flex';
        
        // Start timer if timeout is provided
        if (data.timeout) {
            sandboxTimeout = parseInt(data.timeout);
            startSandboxTimer(sandboxTimeout);
        } else {
            startSandboxTimer(sandboxTimeout); // Use default timeout
        }
        
        addLog('Desktop started successfully', 'success');
    }
    
    // Start sandbox timer
    function startSandboxTimer(timeoutSeconds) {
        // Clear any existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Set initial time
        let remainingSeconds = timeoutSeconds;
        updateTimerDisplay(remainingSeconds);
        
        // Start the timer
        timerInterval = setInterval(() => {
            remainingSeconds--;
            
            if (remainingSeconds <= 0) {
                // Timer expired
                clearInterval(timerInterval);
                timerInterval = null;
                addLog('Sandbox timeout reached', 'warning');
                // The desktop will be automatically killed by the server
            }
            
            updateTimerDisplay(remainingSeconds);
        }, 1000);
    }
    
    // Update timer display
    function updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        // Format as MM:SS
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        // Update display
        sandboxTimerSpan.textContent = formattedTime;
        
        // Change color based on remaining time
        if (seconds < 60) {
            sandboxTimerSpan.className = 'badge bg-danger me-2'; // Less than 1 minute
        } else if (seconds < 300) {
            sandboxTimerSpan.className = 'badge bg-warning me-2'; // Less than 5 minutes
        } else {
            sandboxTimerSpan.className = 'badge bg-secondary me-2'; // More than 5 minutes
        }
    }
    
    // Handle desktop killed event
    function handleDesktopKilled() {
        // Update UI
        
        // Clear sandbox ID
        sandboxIdSpan.textContent = '';
        
        // Hide iframe and show placeholder
        streamFrame.src = '';
        streamFrame.style.display = 'none';
        streamPlaceholder.style.display = 'flex';
        
        // Disable stop button
        stopDesktopBtn.disabled = true;
        stopDesktopBtn.classList.remove('btn-danger');
        stopDesktopBtn.classList.add('btn-secondary');
        
        // Hide sandbox controls
        sandboxControlsDiv.style.display = 'none';
        
        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Reset timer display
        sandboxTimerSpan.textContent = '00:00';
        sandboxTimerSpan.className = 'badge bg-secondary me-2';
        
        addLog('Desktop killed successfully', 'success');
    }
    
    // Run full workflow
    // Run full workflow
    runWorkflowBtn.addEventListener('click', async function() {
        const query = taskInput.value.trim();
        
        if (!query) {
            addLog('Please enter a task prompt', 'error');
            return;
        }
        
        // Show sandbox controls when task is started
        sandboxControlsDiv.style.display = 'flex';
        
        addLog(`Starting full workflow with task: ${query}`, 'info');
        
        try {
            const formData = new FormData();
            formData.append('query', query);
            
            const response = await fetch('/run-workflow', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.status === 'error') {
                addLog(`Error running workflow: ${data.message}`, 'error');
            } else {
                addLog('Workflow started successfully', 'success');
            }
        } catch (error) {
            addLog(`Error running workflow: ${error.message}`, 'error');
        }
    });
    
    // Clear logs
    clearLogsBtn.addEventListener('click', function() {
        logsContainer.innerHTML = '';
        addLog('Logs cleared', 'info');
    });
    
    // Example task buttons
    exampleTaskBtns.forEach(button => {
        button.addEventListener('click', function() {
            const prompt = this.getAttribute('data-prompt');
            if (prompt) {
                // Set the prompt in the task input
                taskInput.value = prompt;
                
                // Highlight the selected button
                exampleTaskBtns.forEach(btn => btn.classList.remove('active', 'btn-secondary'));
                this.classList.add('active', 'btn-secondary');
                this.classList.remove('btn-outline-secondary');
                
                // Log the selection
                addLog(`Example task selected: ${this.textContent}`, 'info');
                
                // Run the task automatically
                runWorkflowBtn.click();
            }
        });
    });
    
    // Stop desktop button
    stopDesktopBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to stop the desktop?')) {
            addLog('Stopping desktop...', 'info');
            
            try {
                const response = await fetch('/kill-desktop', {
                    method: 'POST'
                });
                
                const data = await response.json();
                
                if (data.status === 'error') {
                    addLog(`Error stopping desktop: ${data.message}`, 'error');
                }
                // Success will be handled by the WebSocket message
            } catch (error) {
                addLog(`Error stopping desktop: ${error.message}`, 'error');
            }
        }
    });
    
    // Initialize WebSocket connection
    connectWebSocket();
    
    // Initial log
    addLog('WebUI initialized. Ready to start desktop.', 'info');
});
