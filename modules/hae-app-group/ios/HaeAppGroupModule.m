#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HaeAppGroup, NSObject)
RCT_EXTERN_METHOD(save:(NSString *)serverUrl token:(NSString *)token)
RCT_EXTERN_METHOD(clear)
@end
