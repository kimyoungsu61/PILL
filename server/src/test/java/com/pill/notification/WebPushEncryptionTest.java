package com.pill.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.Map;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import nl.martijndwars.webpush.Utils;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class WebPushEncryptionTest {
    @Test void preparesEncryptedAuthenticatedRequestWithoutSendingNetworkTraffic() throws Exception {
        if(Security.getProvider("BC")==null)Security.addProvider(new BouncyCastleProvider());
        var generator=KeyPairGenerator.getInstance("ECDH","BC");generator.initialize(new ECGenParameterSpec("secp256r1"));
        var server=generator.generateKeyPair();var client=generator.generateKeyPair();var encoder=Base64.getUrlEncoder().withoutPadding();
        var config=new WebPushConfiguration(true,encoder.encodeToString(Utils.encode((ECPublicKey)server.getPublic())),encoder.encodeToString(Utils.encode((ECPrivateKey)server.getPrivate())),"mailto:qa@example.com");
        var sender=new WebPushSender(config,new ObjectMapper());
        var device=new WebPushStore.Device("id",1,1,"https://web.push.apple.com/qa",encoder.encodeToString(Utils.encode((ECPublicKey)client.getPublic())),encoder.encodeToString(new byte[16]),"Asia/Seoul",true);
        var request=sender.prepare(device,Map.of("title","PILL","body","private-dose-info"));
        assertThat(request.uri().getHost()).isEqualTo("web.push.apple.com");assertThat(request.method()).isEqualTo("POST");
        assertThat(request.headers().firstValue("Authorization")).hasValueSatisfying(value->assertThat(value).startsWith("vapid "));
        assertThat(request.headers().firstValue("Content-Encoding")).contains("aes128gcm");
        assertThat(request.bodyPublisher().orElseThrow().contentLength()).isGreaterThan(50);
        assertThat(request.timeout()).isPresent();
        assertThat(request.headers().firstValue("TTL")).contains("300");
        var expiring=sender.prepare(device,Map.of("title","PILL","body","dose","data",Map.of("expiresAt",System.currentTimeMillis()+65000)));
        assertThat(Integer.parseInt(expiring.headers().firstValue("TTL").orElseThrow())).isBetween(1,65);
    }
}
