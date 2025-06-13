        $(document).ready(function() {
            // Setup CSRF token for all AJAX requests
            $.ajaxSetup({
                headers: {
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });

            // Initialize Pusher
            Pusher.logToConsole = true;
            const pusher = new Pusher('fe17bdbbfcc92f520c77', {
                cluster: 'ap1'
            });

            // Single channel for all chats
            const channel = pusher.subscribe('my-channel');

            // Generate unique browser/session ID
            const browserId = 'browser_' + Math.random().toString(36).substr(2, 9);
            console.log('Browser ID:', browserId);

            // Current chat configuration
            let currentConfig = {
                chat: 'walid',
                channelName: 'my-channel',
                event: 'walid-message',
                browserId: browserId
            };

            // Bind to all possible events on the same channel
            const events = ['walid-message', 'renal-message', 'admin-message'];
            
            events.forEach(eventName => {
                channel.bind(eventName, function(data) {
                    console.log(`Received ${eventName} on my-channel:`, data);
                    
                    // IMPORTANT: Jangan tampilkan pesan dari browser yang sama (sender)
                    if (data.browserId && data.browserId === browserId) {
                        console.log('Ignoring message from same browser (sender)');
                        return;
                    }
                    
                    // Handle message untuk chat yang aktif
                    if (eventName === currentConfig.event) {
                        // Pesan untuk chat yang sedang aktif - tampilkan langsung
                        handleIncomingMessage(data);
                    } else {
                        // Pesan untuk chat lain - tampilkan notifikasi saja
                        console.log(`Message received on ${eventName} (background chat)`);
                        showChatNotification(eventName, data);
                    }
                });
            });

            // Get current time
            function getCurrentTime() {
                return new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: false 
                });
            }

            // Update sidebar times on load
            function updateSidebarTimes() {
                $('.chat-time').text(getCurrentTime());
            }

            // Add message to chat
            function addMessage(message, isOwn = false, sender = null) {
                const time = getCurrentTime();
                const messageClass = isOwn ? 'justify-end' : 'justify-start';
                const bubbleClass = isOwn ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border border-gray-200';

                const messageHtml = `
                    <div class="flex ${messageClass}">
                        <div class="${bubbleClass} max-w-xs lg:max-w-sm px-3 lg:px-4 py-2 rounded-lg">
                            ${!isOwn && sender ? `<p class="text-xs text-gray-500 mb-1 font-semibold">${sender}</p>` : ''}
                            <p class="text-sm lg:text-base break-words">${message}</p>
                            <p class="text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'} mt-1 text-right">${time}</p>
                        </div>
                    </div>
                `;

                $('#messagesContainer').append(messageHtml);
                $('#messagesContainer').scrollTop($('#messagesContainer')[0].scrollHeight);
            }

            // Update sidebar last message
            function updateSidebar(chatName, message) {
                $('.chat-item').each(function() {
                    const itemChatName = $(this).find('h3').text().trim();
                    if (itemChatName === chatName) {
                        const shortMessage = message.length > 30 ? message.substring(0, 30) + '...' : message;
                        $(this).find('.chat-last-message').text(shortMessage);
                        $(this).find('.chat-time').text(getCurrentTime());
                    }
                });
            }

            // Handle incoming messages (hanya untuk penerima, bukan pengirim)
            function handleIncomingMessage(data) {
                let message = '';
                let sender = 'Anonymous';
                
                if (typeof data === 'string') {
                    message = data;
                } else if (data.message) {
                    message = data.message;
                    sender = data.sender || 'Anonymous';
                }

                // Tampilkan pesan dari pengirim lain (bukan dari browser ini)
                console.log('Displaying message from:', sender, 'Browser ID:', data.browserId);
                addMessage(message, false, sender);
                updateSidebar(sender, message);
            }

            // Show notification for other chats
            function showChatNotification(eventName, data) {
                // Find the chat item for this event and add notification
                $('.chat-item').each(function() {
                    if ($(this).data('event') === eventName) {
                        const chatName = $(this).find('h3').text().trim();
                        
                        // Update last message in sidebar
                        const message = data.message || 'New message';
                        const shortMessage = message.length > 30 ? message.substring(0, 30) + '...' : message;
                        $(this).find('.chat-last-message').text(shortMessage);
                        $(this).find('.chat-time').text(getCurrentTime());
                        
                        // Add notification badge if not current chat
                        if (!$(this).hasClass('bg-green-50')) {
                            // Add visual notification (red dot, etc)
                            if (!$(this).find('.notification-badge').length) {
                                $(this).find('h3').after('<span class="notification-badge ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">!</span>');
                            }
                        }
                    }
                });
            }

            // Send message with jQuery AJAX
            function sendMessage() {
                const message = $('#messageInput').val().trim();
                if (!message) return;

                // 1. Tampilkan pesan LANGSUNG di UI pengirim (tidak menunggu Pusher)
                addMessage(message, true);
                $('#messageInput').val('');
                
                // 2. Update sidebar untuk pengirim
                updateSidebar(currentConfig.chat.toUpperCase(), message);

                // 3. Kirim ke backend untuk broadcast ke penerima lain
                $.ajax({
                    url: 'https://ramanur.mebelin.my.id/api/broadcast',
                    type: 'POST',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        message: message,
                        sender: currentConfig.chat.toUpperCase(),
                        channel: currentConfig.channelName,
                        event: currentConfig.event,
                        browserId: currentConfig.browserId,
                        timestamp: new Date().toISOString()
                    }),
                    success: function(response) {
                        console.log('Message broadcasted successfully:', response);
                        // Pesan sudah ditampilkan di step 1, tidak perlu action lagi
                    },
                    error: function(xhr, status, error) {
                        console.error('Failed to send message:', error);
                        
                        // Jika gagal kirim, tampilkan pesan error
                        addMessage('❌ Failed to send message. Please check your connection.', false, 'System');
                    }
                });
            }

            // Event listeners
            $('#sendButton').on('click', sendMessage);
            
            $('#messageInput').on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    sendMessage();
                }
            });

            // Chat selection with dynamic event switching (same channel)
            $('.chat-item').on('click', function() {
                // Remove active styling from all items
                $('.chat-item').removeClass('bg-blue-50 border-l-4 border-blue-500');
                
                // Remove notification badge when opening chat
                $(this).find('.notification-badge').remove();

                // Add active styling to clicked item
                $(this).addClass('bg-blue-50 border-l-4 border-blue-500');

                // Get new chat configuration
                const newChatName = $(this).find('h3').text().trim();
                const newEvent = $(this).data('event');
                const firstLetter = newChatName.charAt(0);
                
                // Set avatar colors
                const avatarColors = {
                    'WALID': 'bg-blue-500',
                    'RENAL': 'bg-purple-500', 
                    'ADMIN': 'bg-red-500'
                };

                // Update current configuration (channel tetap sama)
                currentConfig.chat = $(this).data('chat');
                currentConfig.event = newEvent;

                // Update UI
                $('#chatName').text(newChatName);
                $('#chatAvatar').removeClass('bg-blue-500 bg-purple-500 bg-red-500').addClass(avatarColors[newChatName]).text(firstLetter);
                $('#currentEvent').text(newEvent);

                // Clear messages and show welcome
                $('#messagesContainer').html(`
                    <div class="flex justify-center">
                        <div class="bg-blue-100 text-blue-800 px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm text-center max-w-xs lg:max-w-none">
                            Welcome to ${newChatName} Chat! Start typing to send messages.
                        </div>
                    </div>
                `);

                // Close sidebar on mobile after selection
                if (window.innerWidth < 1024) {
                    closeMobileSidebar();
                }

                console.log('Switched to:', currentConfig);
            });

            // Mobile menu functionality
            function openMobileSidebar() {
                $('#sidebar').removeClass('-translate-x-full');
                $('#mobileOverlay').removeClass('hidden');
                $('body').addClass('overflow-hidden');
            }

            function closeMobileSidebar() {
                $('#sidebar').addClass('-translate-x-full');
                $('#mobileOverlay').addClass('hidden');
                $('body').removeClass('overflow-hidden');
            }

            $('#mobileMenuBtn').on('click', openMobileSidebar);
            $('#closeSidebarBtn').on('click', closeMobileSidebar);
            $('#mobileOverlay').on('click', closeMobileSidebar);

            // Handle resize
            $(window).on('resize', function() {
                if (window.innerWidth >= 1024) {
                    // Desktop view - always show sidebar
                    $('#sidebar').removeClass('-translate-x-full');
                    $('#mobileOverlay').addClass('hidden');
                    $('body').removeClass('overflow-hidden');
                } else {
                    // Mobile view - hide sidebar by default
                    if (!$('#sidebar').hasClass('-translate-x-full')) {
                        closeMobileSidebar();
                    }
                }
            });

            // Initialize sidebar times
            updateSidebarTimes();
        });
