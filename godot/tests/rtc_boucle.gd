## Deux connexions WebRTC dans le même programme, reliées à la main : l'extension se charge-t-elle,
## et un canal de données passe-t-il ?
##
##   godot --headless --path godot --script res://tests/rtc_boucle.gd
extends SceneTree

var a := WebRTCPeerConnection.new()
var b := WebRTCPeerConnection.new()
var ca: WebRTCDataChannel
var cb: WebRTCDataChannel
var t := 0.0
var recu := []


func _init() -> void:
	print("WebRTC : ", ClassDB.class_exists("WebRTCPeerConnection"))
	var cfg := { "iceServers": [] }
	print("init ", a.initialize(cfg), " ", b.initialize(cfg))
	a.session_description_created.connect(func(type, sdp): a.set_local_description(type, sdp); b.set_remote_description(type, sdp))
	b.session_description_created.connect(func(type, sdp): b.set_local_description(type, sdp); a.set_remote_description(type, sdp))
	a.ice_candidate_created.connect(func(m, i, n): b.add_ice_candidate(m, i, n))
	b.ice_candidate_created.connect(func(m, i, n): a.add_ice_candidate(m, i, n))
	b.data_channel_received.connect(func(ch): cb = ch; print("canal reçu : ", ch.get_label()))
	ca = a.create_data_channel("dc_essai", { "ordered": false })
	print("offre ", a.create_offer())


func _process(delta: float) -> bool:
	t += delta
	a.poll(); b.poll()
	if ca: ca.poll()
	if cb:
		cb.poll()
		while cb.get_available_packet_count() > 0: recu.append(cb.get_packet().get_string_from_utf8())
	if ca and ca.get_ready_state() == WebRTCDataChannel.STATE_OPEN and recu.is_empty():
		ca.put_packet("bonjour".to_utf8_buffer())
	if recu.size() > 0:
		print("reçu : ", recu[0], " après ", snappedf(t, 0.01), " s")
		return true
	if t > 10:
		print("ÉCHEC : états ", a.get_connection_state(), " ", ca.get_ready_state())
		return true
	return false
