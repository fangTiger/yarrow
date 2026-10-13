## MODIFIED Requirements

### Requirement: 示例结果

首页 MUST 在付款之前提供「示例结果」入口，依次为命理、问事、运势、起名四卦，打开即为完整结果页，只读，并有「示例」横幅。示例页 MUST 不读取访客本机生辰。

#### Scenario: 先看示例

- **WHEN** 用户点「See a sample reading」
- **THEN** 不连钱包即可看到一卦完整的英文结果页，没有可操作的重试或修改按钮
- **AND** 第一个示例是命理，含性格画像与一生运势

## ADDED Requirements

### Requirement: 命理优先的首页说明

首页一句话说明 MUST 突出一生运势与性格，并说明过去的运可对照亲历；三步说明的第一步 MUST 写明「填生辰（问题选填）」。命理的示例问题 MUST 为「我这辈子的运势走向如何？」「我的性格优势是什么？」及其英文。

#### Scenario: 首次打开

- **WHEN** 英语用户打开首页
- **THEN** 看到「Enter your birth date to see the ten-year luck cycles of your life…」，命理已默认选中
